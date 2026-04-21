import { Article, Audio, Author, Content, SearchParams, Topic, Video } from '../types';
import { ContentProvider } from './provider';

/**
 * RealProvider — talks to the torahweb.org backend once it's live.
 *
 * Set `baseUrl` to the production API root and flip USE_REAL_BACKEND in `./api.ts`
 * once the owner's team ships the database. No screen/component changes required.
 */
export class RealProvider implements ContentProvider {
  constructor(private readonly baseUrl: string) {}

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      throw new Error(`TorahWeb API ${path} → ${res.status}`);
    }
    return (await res.json()) as T;
  }

  getAuthors() {
    return this.get<Author[]>('/authors');
  }
  getAuthor(idOrSlug: string) {
    return this.get<Author | null>(`/authors/${encodeURIComponent(idOrSlug)}`);
  }
  getTopics() {
    return this.get<Topic[]>('/topics');
  }
  getRecent(limit = 4) {
    return this.get<Article[]>(`/recent?limit=${limit}`);
  }
  getThisWeek() {
    return this.get<Article | null>('/this-week');
  }
  getContentByAuthor(authorId: string) {
    return this.get<Content[]>(`/authors/${encodeURIComponent(authorId)}/content`);
  }
  getContentByTopic(topicSlug: string) {
    return this.get<Content[]>(`/topics/${encodeURIComponent(topicSlug)}/content`);
  }
  getArticle(id: string) {
    return this.get<Article | null>(`/articles/${encodeURIComponent(id)}`);
  }
  getVideo(id: string) {
    return this.get<Video | null>(`/videos/${encodeURIComponent(id)}`);
  }
  getAudio(id: string) {
    return this.get<Audio | null>(`/audio/${encodeURIComponent(id)}`);
  }
  searchContent(params: SearchParams) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    });
    return this.get<Content[]>(`/search?${qs.toString()}`);
  }
}
