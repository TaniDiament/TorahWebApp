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

export type ContentType = 'article' | 'video' | 'audio';

export interface Article {
  kind: 'article';
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
  kind: 'video';
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
  kind: 'audio';
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

export interface SearchParams {
  query?: string;
  authorId?: string;
  topicId?: string;
  contentType?: ContentType;
}

export interface EventFlier {
  id: string;
  title: string;
  flierUrl: string;
  eventDate: string;
  videoContentId: string | null;
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
  artworkUrl?: string;
}

// Use the `kind` discriminant rather than structural `'foo' in c` checks —
// hydrated summaries can be missing type-specific fields (e.g. a Video
// projected from content.json has no vimeoId yet), but the discriminant is
// always set.
export const isArticle = (c: Content): c is Article => c.kind === 'article';
export const isVideo = (c: Content): c is Video => c.kind === 'video';
export const isAudio = (c: Content): c is Audio => c.kind === 'audio';
