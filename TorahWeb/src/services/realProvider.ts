import {
  Article,
  Audio,
  Author,
  Content,
  ContentType,
  SearchParams,
  Topic,
  Video,
} from '../types';
import { ContentProvider } from './provider';
import { SearchIndexCache, normalizeQuery } from './searchIndexCache';

/**
 * RealProvider — fetches static JSON files published by torahweb.org.
 *
 * Schema is documented in /BACKEND_SCHEMA.md at the repo root. All endpoints
 * are plain files (no query strings), so every request is cacheable by any
 * CDN. Search runs client-side against a prebuilt haystack index.
 */

interface Manifest {
  version: number;
  generatedAt: string;
  counts: { authors: number; topics: number; content: number };
  hashes: Record<string, string>;
}

interface ContentSummary {
  id: string;
  type: ContentType;
  title: string;
  authorId: string;
  topicSlugs: string[];
  publishedDate: string;
  excerpt: string | null;
  parshaLabel: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  url: string | null;
}

interface RawArticle {
  id: string;
  title: string;
  content: string;
  authorId: string;
  topicSlugs: string[];
  publishedDate: string;
  parshaLabel?: string | null;
  excerpt?: string | null;
  url?: string | null;
}

interface RawAudio {
  id: string;
  title: string;
  audioUrl: string;
  authorId: string;
  topicSlugs: string[];
  publishedDate: string;
  duration?: number | null;
  description?: string | null;
}

interface RawVideo {
  id: string;
  title: string;
  vimeoId?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  authorId: string;
  topicSlugs: string[];
  publishedDate: string;
  duration?: number | null;
  description?: string | null;
}

export class RealProvider implements ContentProvider {
  private authorsP?: Promise<Author[]>;
  private topicsP?: Promise<Topic[]>;
  private contentP?: Promise<ContentSummary[]>;
  private recentP?: Promise<string[]>;
  private thisWeekP?: Promise<string | null>;
  private readonly searchCache: SearchIndexCache;

  constructor(private readonly baseUrl: string) {
    this.searchCache = new SearchIndexCache(baseUrl);
  }

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(this.url(path));
    if (!res.ok) {
      throw new Error(`TorahWeb ${path} → ${res.status}`);
    }
    return (await res.json()) as T;
  }

  private async getOrNull<T>(path: string): Promise<T | null> {
    const res = await fetch(this.url(path));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`TorahWeb ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  private authors() {
    return (this.authorsP ??= this.get<Author[]>('authors.json'));
  }
  private topics() {
    return (this.topicsP ??= this.get<Topic[]>('topics.json'));
  }
  private content() {
    return (this.contentP ??= this.get<ContentSummary[]>('content.json'));
  }
  private recent() {
    return (this.recentP ??= this.get<{ ids: string[] }>('recent.json').then(
      (r) => r.ids,
    ));
  }
  private thisWeekId() {
    return (this.thisWeekP ??= this.get<{ articleId: string | null }>(
      'this-week.json',
    ).then((r) => r.articleId));
  }

  private async hydrateSummary(s: ContentSummary): Promise<Content> {
    const [authors, topics] = await Promise.all([this.authors(), this.topics()]);
    const author =
      authors.find((a) => a.id === s.authorId) ??
      ({ id: s.authorId, slug: s.authorId, name: s.authorId } as Author);
    const summaryTopics = s.topicSlugs
      .map((slug) => topics.find((t) => t.slug === slug))
      .filter((t): t is Topic => !!t);

    if (s.type === 'article') {
      const a: Article = {
        id: s.id,
        title: s.title,
        content: '',
        author,
        topics: summaryTopics,
        publishedDate: s.publishedDate,
        parshaLabel: s.parshaLabel ?? undefined,
        excerpt: s.excerpt ?? undefined,
        url: s.url ?? undefined,
      };
      return a;
    }
    if (s.type === 'audio') {
      const a: Audio = {
        id: s.id,
        title: s.title,
        audioUrl: '',
        author,
        topics: summaryTopics,
        publishedDate: s.publishedDate,
        duration: s.duration ?? undefined,
      };
      return a;
    }
    const v: Video = {
      id: s.id,
      title: s.title,
      thumbnailUrl: s.thumbnailUrl ?? undefined,
      author,
      topics: summaryTopics,
      publishedDate: s.publishedDate,
      duration: s.duration ?? undefined,
    };
    return v;
  }

  getAuthors() {
    return this.authors();
  }

  async getAuthor(idOrSlug: string) {
    const authors = await this.authors();
    return (
      authors.find((a) => a.id === idOrSlug || a.slug === idOrSlug) ?? null
    );
  }

  getTopics() {
    return this.topics();
  }

  async getRecent(limit = 4): Promise<Article[]> {
    const [ids, all] = await Promise.all([this.recent(), this.content()]);
    const byId = new Map(all.map((c) => [c.id, c]));
    const picks = ids
      .map((id) => byId.get(id))
      .filter((c): c is ContentSummary => !!c && c.type === 'article')
      .slice(0, limit);
    return Promise.all(picks.map((s) => this.hydrateSummary(s) as Promise<Article>));
  }

  async getThisWeek(): Promise<Article | null> {
    const id = await this.thisWeekId();
    if (!id) return null;
    return this.getArticle(id);
  }

  async getContentByAuthor(authorId: string): Promise<Content[]> {
    const all = await this.content();
    const matches = all.filter((c) => c.authorId === authorId);
    return Promise.all(matches.map((s) => this.hydrateSummary(s)));
  }

  async getContentByTopic(topicSlug: string): Promise<Content[]> {
    const all = await this.content();
    const matches = all.filter((c) => c.topicSlugs.includes(topicSlug));
    return Promise.all(matches.map((s) => this.hydrateSummary(s)));
  }

  async getArticle(id: string): Promise<Article | null> {
    const raw = await this.getOrNull<RawArticle>(`articles/${encodeURIComponent(id)}.json`);
    if (!raw) return null;
    const [authors, topics] = await Promise.all([this.authors(), this.topics()]);
    const author =
      authors.find((a) => a.id === raw.authorId) ??
      ({ id: raw.authorId, slug: raw.authorId, name: raw.authorId } as Author);
    return {
      id: raw.id,
      title: raw.title,
      content: raw.content,
      author,
      topics: raw.topicSlugs
        .map((slug) => topics.find((t) => t.slug === slug))
        .filter((t): t is Topic => !!t),
      publishedDate: raw.publishedDate,
      parshaLabel: raw.parshaLabel ?? undefined,
      excerpt: raw.excerpt ?? undefined,
      url: raw.url ?? undefined,
    };
  }

  async getAudio(id: string): Promise<Audio | null> {
    const raw = await this.getOrNull<RawAudio>(`audio/${encodeURIComponent(id)}.json`);
    if (!raw) return null;
    const [authors, topics] = await Promise.all([this.authors(), this.topics()]);
    const author =
      authors.find((a) => a.id === raw.authorId) ??
      ({ id: raw.authorId, slug: raw.authorId, name: raw.authorId } as Author);
    return {
      id: raw.id,
      title: raw.title,
      audioUrl: raw.audioUrl,
      author,
      topics: raw.topicSlugs
        .map((slug) => topics.find((t) => t.slug === slug))
        .filter((t): t is Topic => !!t),
      publishedDate: raw.publishedDate,
      duration: raw.duration ?? undefined,
      description: raw.description ?? undefined,
    };
  }

  async getVideo(id: string): Promise<Video | null> {
    const raw = await this.getOrNull<RawVideo>(`videos/${encodeURIComponent(id)}.json`);
    if (!raw) return null;
    const [authors, topics] = await Promise.all([this.authors(), this.topics()]);
    const author =
      authors.find((a) => a.id === raw.authorId) ??
      ({ id: raw.authorId, slug: raw.authorId, name: raw.authorId } as Author);
    return {
      id: raw.id,
      title: raw.title,
      vimeoId: raw.vimeoId ?? undefined,
      videoUrl: raw.videoUrl ?? undefined,
      thumbnailUrl: raw.thumbnailUrl ?? undefined,
      author,
      topics: raw.topicSlugs
        .map((slug) => topics.find((t) => t.slug === slug))
        .filter((t): t is Topic => !!t),
      publishedDate: raw.publishedDate,
      duration: raw.duration ?? undefined,
      description: raw.description ?? undefined,
    };
  }

  async searchContent(params: SearchParams): Promise<Content[]> {
    const all = await this.content();
    const byId = new Map(all.map((c) => [c.id, c]));

    let ordered: ContentSummary[];

    const normalized = params.query ? normalizeQuery(params.query) : '';
    if (normalized) {
      const entries = await this.searchCache.getEntries();
      const terms = normalized.split(' ').filter(Boolean);
      const scored: { summary: ContentSummary; score: number }[] = [];
      for (const e of entries) {
        if (!terms.every((t) => e.haystack.includes(t))) continue;
        const summary = byId.get(e.id);
        if (!summary) continue;
        const title = summary.title.toLowerCase();
        let score = 0;
        if (title === normalized) score += 1000;
        else if (title.startsWith(normalized)) score += 500;
        else if (terms.every((t) => title.includes(t))) score += 200;
        score += Date.parse(summary.publishedDate) / 1e11;
        scored.push({ summary, score });
      }
      scored.sort((a, b) => b.score - a.score);
      ordered = scored.map((s) => s.summary);
    } else {
      ordered = all;
    }

    if (params.authorId) {
      ordered = ordered.filter((c) => c.authorId === params.authorId);
    }
    if (params.topicId) {
      ordered = ordered.filter((c) => c.topicSlugs.includes(params.topicId!));
    }
    if (params.contentType) {
      ordered = ordered.filter((c) => c.type === params.contentType);
    }

    return Promise.all(ordered.map((s) => this.hydrateSummary(s)));
  }
}
