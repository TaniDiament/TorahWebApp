export interface Author {
  id: string;
  name: string;
  bio?: string;
  imageUrl?: string;
}

export interface Topic {
  id: string;
  name: string;
  description?: string;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  author: Author;
  topics: Topic[];
  publishedDate: string;
  excerpt?: string;
  url?: string;
}

export interface Video {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  author: Author;
  topics: Topic[];
  publishedDate: string;
  duration?: number;
  description?: string;
}

export interface Audio {
  id: string;
  title: string;
  audioUrl: string;
  author: Author;
  topics: Topic[];
  publishedDate: string;
  duration?: number;
  description?: string;
}

export type Content = Article | Video | Audio;

export type ContentType = 'article' | 'video' | 'audio';

export interface SearchParams {
  query?: string;
  authorId?: string;
  topicId?: string;
  contentType?: ContentType;
}

