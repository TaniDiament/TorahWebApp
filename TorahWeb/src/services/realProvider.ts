import {
  Article,
  Audio,
  Author,
  Content,
  ContentType,
  EventFlier,
  SearchParams,
  Topic,
  Video,
} from '../types';
import { ContentProvider } from './provider';
import { byAuthorLastName, byNewestFirst } from './ordering';
import { SearchIndexCache, normalizeQuery } from './searchIndexCache';
import { CatalogCache } from './catalogCache';

/**
 * RealProvider — fetches static JSON files published by torahweb.org.
 *
 * Schema is documented in /BACKEND_SCHEMA.md at the repo root. All endpoints
 * are plain files (no query strings), so every request is cacheable by any
 * CDN. Search runs client-side against a prebuilt haystack index.
 */

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
  private readonly searchCache: SearchIndexCache;
  // Catalog files (authors / topics / content / recent / this-week / events)
  // are read through CatalogCache, which persists them to disk and revalidates
  // against manifest.json — so it owns their memoization and offline fallback.
  private readonly catalog: CatalogCache;

  constructor(private readonly baseUrl: string) {
    this.searchCache = new SearchIndexCache(baseUrl);
    this.catalog = new CatalogCache(baseUrl);
  }

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  // Per-item files (articles/audio/videos) are fetched on demand and aren't
  // part of the manifest-cached catalog, so they keep a direct fetch path.
  private async getOrNull<T>(path: string): Promise<T | null> {
    const res = await fetch(this.url(path));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`TorahWeb ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  private authors() {
    return this.catalog.getFile<Author[]>('authors', 'authors.json');
  }
  private topics() {
    return this.catalog.getFile<Topic[]>('topics', 'topics.json');
  }
  private content() {
    return this.catalog.getFile<ContentSummary[]>('content', 'content.json');
  }
  private async recent(): Promise<string[]> {
    const r = await this.catalog.getFile<{ ids: string[] }>('recent', 'recent.json');
    return r.ids;
  }
  private async thisWeekId(): Promise<string | null> {
    const r = await this.catalog.getFile<{ articleId: string | null }>(
      'thisWeek',
      'this-week.json',
    );
    return r.articleId;
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
        kind: 'article',
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
        kind: 'audio',
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
      kind: 'video',
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

  async getAuthors() {
    // authors.json ships in id order; the directory shows them alphabetized by
    // surname. Sort a copy — the CatalogCache array is shared/cached.
    const authors = await this.authors();
    return [...authors].sort(byAuthorLastName);
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

  async getRecent(limit = 4): Promise<Content[]> {
    // The recent.json feed is an article-first ordering, but the Home screen
    // expects a mixed Recently Added section across all media. Pull from the
    // full content index sorted by publishedDate so audio and video surface
    // alongside divrei torah, then fall back to the recent.json ordering for
    // any ties (preserves curated ordering for same-day items).
    const [ids, all] = await Promise.all([this.recent(), this.content()]);
    const recentRank = new Map(ids.map((id, idx) => [id, idx]));
    const sorted = [...all].sort((a, b) => {
      const t = new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      if (t !== 0) return t;
      const ra = recentRank.get(a.id) ?? Number.POSITIVE_INFINITY;
      const rb = recentRank.get(b.id) ?? Number.POSITIVE_INFINITY;
      return ra - rb;
    });
    const picks = sorted.slice(0, limit);
    return Promise.all(picks.map((s) => this.hydrateSummary(s)));
  }

  async getThisWeek(): Promise<Article | null> {
    const id = await this.thisWeekId();
    if (!id) return null;
    return this.getArticle(id);
  }

  getCurrentEvent(): Promise<EventFlier | null> {
    // events.json rides the same manifest-validated cache so the banner
    // survives offline; a 404, network error, or malformed payload all resolve
    // to `null` and the banner simply hides.
    return this.catalog
      .getFile<{ event: EventFlier | null }>('event', 'events.json')
      .then((r) => r?.event ?? null)
      .catch(() => null);
  }

  async getContentByAuthor(authorId: string): Promise<Content[]> {
    const all = await this.content();
    const matches = all.filter((c) => c.authorId === authorId);
    const hydrated = await Promise.all(matches.map((s) => this.hydrateSummary(s)));
    // An author's page lists their shiurim/divrei torah most-recent-first.
    return hydrated.sort(byNewestFirst);
  }

  async getContentByTopic(topicSlug: string): Promise<Content[]> {
    const all = await this.content();
    const matches = all.filter((c) => c.topicSlugs.includes(topicSlug));
    return Promise.all(matches.map((s) => this.hydrateSummary(s)));
  }

  async getContentByParsha(parshaLabel: string): Promise<Content[]> {
    const target = parshaLabel.trim().toLowerCase();
    const all = await this.content();
    const matches = all.filter(
      (c) => (c.parshaLabel ?? '').trim().toLowerCase() === target,
    );
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
      kind: 'article',
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
      kind: 'audio',
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
      kind: 'video',
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
      // Try Lucene index first (BM25-scored, stemmed, proper relevance)
      let luceneResults: { id: string; score: number }[] | null = null;
      try {
        const luceneIndex = await this.searchCache.getLuceneIndex();
        const results = luceneIndex.search(normalized);
        if (results.length > 0) {
          luceneResults = results;
        }
      } catch {
        // Lucene index unavailable — fall back to haystack matching
      }

      if (luceneResults) {
        // Use Lucene-ranked results
        const scored: { summary: ContentSummary; score: number }[] = [];
        for (const r of luceneResults) {
          const summary = byId.get(r.id);
          if (!summary) continue;
          // Add a recency bonus on top of Lucene's BM25 score
          const recencyBonus = Date.parse(summary.publishedDate) / 1e14;
          scored.push({ summary, score: r.score + recencyBonus });
        }
        scored.sort((a, b) => b.score - a.score);
        ordered = scored.map((s) => s.summary);
      } else {
        // Fallback: haystack substring matching (no Lucene index available)
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
      }
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
