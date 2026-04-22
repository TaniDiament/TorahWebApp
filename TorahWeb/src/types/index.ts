export interface Author {
  id: string;
  slug: string;
  name: string;
  bio?: string;
  portraitUrl?: string;
}

export interface Topic {
  id: string;
  slug: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  cta?: string;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  author: Author;
  topics: Topic[];
  publishedDate: string;
  parshaLabel?: string;
  excerpt?: string;
  url?: string;
}

export interface Video {
  id: string;
  title: string;
  vimeoId?: string;
  videoUrl?: string;
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

export type DownloadKind = 'article' | 'audio';

export interface DownloadItem {
  id: string;
  contentId: string;
  title: string;
  authorName: string;
  publishedDate: string;
  kind: DownloadKind;
  filePath: string;
  mimeType: string;
  createdAt: string;
  sourceUrl?: string;
}

export const isArticle = (c: Content): c is Article => 'content' in c;
export const isVideo = (c: Content): c is Video =>
  'vimeoId' in c || ('videoUrl' in c && !('audioUrl' in c));
export const isAudio = (c: Content): c is Audio =>
  'audioUrl' in c && !('videoUrl' in c) && !('vimeoId' in c);
