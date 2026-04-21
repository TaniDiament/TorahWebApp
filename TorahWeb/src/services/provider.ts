import { Article, Audio, Author, Content, Topic, Video, SearchParams } from '../types';

export interface ContentProvider {
  getAuthors(): Promise<Author[]>;
  getAuthor(idOrSlug: string): Promise<Author | null>;

  getTopics(): Promise<Topic[]>;

  getRecent(limit?: number): Promise<Article[]>;
  getThisWeek(): Promise<Article | null>;

  getContentByAuthor(authorId: string): Promise<Content[]>;
  getContentByTopic(topicSlug: string): Promise<Content[]>;

  getArticle(id: string): Promise<Article | null>;
  getVideo(id: string): Promise<Video | null>;
  getAudio(id: string): Promise<Audio | null>;

  searchContent(params: SearchParams): Promise<Content[]>;
}
