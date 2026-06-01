import { Alert, Platform, Share } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { api } from './api';
import { Article, Content, DownloadItem, DownloadKind, SavedItem, isArticle, isAudio } from '../types';

const { fs } = RNBlobUtil;
const MANIFEST_PATH = `${fs.dirs.DocumentDir}/torahweb-downloads.json`;
// Saved items are a separate, file-less manifest — references the user keeps in
// their Library without a download (the only option for video).
const SAVED_MANIFEST_PATH = `${fs.dirs.DocumentDir}/torahweb-saved.json`;
const ARTICLE_MIME = 'application/json';

const sanitizeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

const extensionFromUrl = (url: string, fallback: string) => {
  const clean = url.split('?')[0];
  const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.') + 1) : '';
  return ext.length > 0 && ext.length <= 6 ? ext : fallback;
};

const asDownloadKind = (content: Content): DownloadKind => (isAudio(content) ? 'audio' : 'article');

const readManifest = async (): Promise<DownloadItem[]> => {
  try {
    const exists = await fs.exists(MANIFEST_PATH);
    if (!exists) {
      return [];
    }

    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DownloadItem[]) : [];
  } catch {
    return [];
  }
};

const writeManifest = async (items: DownloadItem[]) => {
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(items), 'utf8');
};

const saveDownloadedItem = async (item: DownloadItem) => {
  const current = await readManifest();
  const filtered = current.filter((existing) => existing.id !== item.id);
  await writeManifest([item, ...filtered]);
};

const getAudioRemote = (content: Content) => {
  if (!isAudio(content)) return null;
  return {
    url: content.audioUrl,
    extension: extensionFromUrl(content.audioUrl, 'm4a'),
    mime: 'audio/m4a',
  };
};

// Articles are stored as a JSON snapshot of the full Article object so the
// in-app reader (ContentScreen) can render them offline with the same layout
// as live content — including topics, parsha label, and the author portrait.
const writeArticleSnapshot = async (article: Article, folder: string) => {
  const fileName = `${sanitizeFileName(article.title) || article.id}.article.json`;
  const path = `${folder}/${fileName}`;
  await fs.writeFile(path, JSON.stringify(article), 'utf8');
  return path;
};

export const canDownloadContent = (content: Content) => isArticle(content) || isAudio(content);

export const getDownloadedItems = async (): Promise<DownloadItem[]> => {
  const items = await readManifest();
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// --- Saved items -----------------------------------------------------------
// Saved items live in their own manifest and carry no on-disk file; they're
// pure references resolved live when opened.
const readSavedManifest = async (): Promise<SavedItem[]> => {
  try {
    const exists = await fs.exists(SAVED_MANIFEST_PATH);
    if (!exists) return [];
    const raw = await fs.readFile(SAVED_MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedItem[]) : [];
  } catch {
    return [];
  }
};

const writeSavedManifest = async (items: SavedItem[]) => {
  await fs.writeFile(SAVED_MANIFEST_PATH, JSON.stringify(items), 'utf8');
};

const buildSavedItem = (content: Content): SavedItem => ({
  contentId: content.id,
  kind: content.kind,
  title: content.title,
  authorName: content.author.name,
  publishedDate: content.publishedDate,
  artworkUrl: content.author.portraitUrl,
  savedAt: new Date().toISOString(),
});

export const getSavedItems = async (): Promise<SavedItem[]> => {
  const items = await readSavedManifest();
  return items.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
};

// Save a reference to the Library. Idempotent (matched by stable contentId);
// returns the existing entry if it's already saved.
export const saveContent = async (content: Content): Promise<SavedItem> => {
  const current = await readSavedManifest();
  const existing = current.find((entry) => entry.contentId === content.id);
  if (existing) return existing;
  const item = buildSavedItem(content);
  await writeSavedManifest([item, ...current]);
  return item;
};

export const removeSavedItem = async (contentId: string): Promise<void> => {
  const current = await readSavedManifest();
  await writeSavedManifest(current.filter((entry) => entry.contentId !== contentId));
};

const buildDownloadItem = (
  content: Content,
  filePath: string,
  mimeType: string,
  sourceUrl?: string,
): DownloadItem => ({
  id: `${content.id}-${Date.now()}`,
  contentId: content.id,
  title: content.title,
  authorName: content.author.name,
  publishedDate: content.publishedDate,
  kind: asDownloadKind(content),
  filePath,
  mimeType,
  createdAt: new Date().toISOString(),
  sourceUrl,
  artworkUrl: content.author.portraitUrl,
});

// Returns the parsed Article from a downloaded snapshot, or null if the file
// is missing / malformed / from a legacy non-snapshot download (those are
// still openable through openDownloadedItem's OS hand-off path).
export const loadDownloadedArticle = async (item: DownloadItem): Promise<Article | null> => {
  if (item.mimeType !== ARTICLE_MIME) return null;
  try {
    const exists = await fs.exists(item.filePath);
    if (!exists) return null;
    const raw = await fs.readFile(item.filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'content' in parsed) {
      // Legacy snapshots (pre-kind-discriminant) won't have `kind`; tag
      // them in-flight so the rest of the app's type narrowing still works.
      return { ...parsed, kind: 'article' } as Article;
    }
    return null;
  } catch {
    return null;
  }
};

export const openDownloadedItem = async (item: DownloadItem) => {
  const exists = await fs.exists(item.filePath);
  if (!exists) {
    Alert.alert('File missing', 'This file no longer exists on your device.');
    return;
  }

  // Audio plays inside the app via TrackPlayer and articles render in the
  // in-app ContentScreen — DownloadsScreen handles both of those paths
  // directly, so we only reach the OS hand-off branches below for legacy
  // article files that predate the JSON snapshot format.
  if (item.kind === 'audio') {
    return;
  }
  if (item.kind === 'article' && item.mimeType === ARTICLE_MIME) {
    return;
  }

  if (Platform.OS === 'android') {
    await RNBlobUtil.android.actionViewIntent(item.filePath, item.mimeType);
    return;
  }

  await Share.share({
    url: `file://${item.filePath}`,
    title: item.title,
    message: item.title,
  });
};

export const removeDownloadedItem = async (item: DownloadItem) => {
  try {
    const exists = await fs.exists(item.filePath);
    if (exists) {
      await fs.unlink(item.filePath);
    }
  } catch {
    // Ignore file delete errors and still clean history entry.
  }

  const current = await readManifest();
  await writeManifest(current.filter((entry) => entry.id !== item.id));
};

// Fills in any missing fields on a list-view Article — `hydrateSummary` in
// the real provider intentionally leaves `content: ''` on summaries, so a
// download from a list card would otherwise save a near-empty file. We fetch
// the canonical Article exactly once at download time.
const resolveFullArticle = async (article: Article): Promise<Article> => {
  if (article.content && article.content.trim().length > 0) return article;
  try {
    const fresh = await api.getArticle(article.id);
    if (fresh) return fresh;
  } catch (err) {
    console.warn('Article hydrate failed before download:', err);
  }
  return article;
};

export interface DownloadOptions {
  // Reports download progress as a 0..1 ratio, or null when the total size
  // isn't known (article snapshots, or audio whose server omits
  // Content-Length) — callers should show an indeterminate indicator for null.
  onProgress?: (ratio: number | null) => void;
}

// Drives the actual fetch/write. Progress is surfaced through `onProgress`
// rather than the old fire-and-wait Alerts — the DownloadsProvider now owns the
// user-facing feedback (live progress in the Library, an alert only on
// failure), so this resolves with the saved DownloadItem and *throws* on error
// so the caller can mark the in-flight download as failed.
export const downloadContent = async (
  content: Content,
  options?: DownloadOptions,
): Promise<DownloadItem | null> => {
  const audioRemote = getAudioRemote(content);
  const baseName = sanitizeFileName(content.title) || content.id;

  // If this content (matched by stable contentId, not the per-download id) is
  // already in the manifest AND the file is still on disk, reuse the existing
  // entry instead of re-fetching. Stale manifest rows whose files have been
  // deleted out-of-band are skipped so the user can recover by triggering a
  // fresh download.
  const existing = (await readManifest()).find((entry) => entry.contentId === content.id);
  if (existing && (await fs.exists(existing.filePath))) {
    options?.onProgress?.(1);
    return existing;
  }

  // --- Audio -----------------------------------------------------------------
  // Audio is kept entirely inside app-private storage on both platforms so the
  // OS file picker / Files app can't see it and so playback can only happen
  // through the in-app TrackPlayer. We deliberately bypass Android's
  // DownloadManager (which would publish the file to the public Downloads
  // collection) and skip the iOS Share sheet (which would let the user hand the
  // file off to another player).
  if (audioRemote) {
    const destination = `${fs.dirs.DocumentDir}/${baseName}.${audioRemote.extension}`;
    const task = RNBlobUtil.config({
      path: destination,
      // Keep downloading when the app is backgrounded: on iOS this runs the
      // transfer on a background URLSession, so switching to another app (or
      // locking the phone) mid-download doesn't pause it. On Android the fetch
      // already runs off the JS thread and continues while the app is cached in
      // the background.
      IOSBackgroundTask: true,
    }).fetch('GET', audioRemote.url);
    // Throttle native→JS progress events to ~5/sec so a large shiur doesn't
    // spam the bridge / re-render the Library list on every received chunk.
    task.progress({ count: -1, interval: 200 }, (received, total) => {
      const r = Number(received);
      const t = Number(total);
      options?.onProgress?.(t > 0 ? Math.min(1, r / t) : null);
    });
    await task;

    const item = buildDownloadItem(content, destination, audioRemote.mime, audioRemote.url);
    await saveDownloadedItem(item);
    options?.onProgress?.(1);
    return item;
  }

  // --- Article (divrei torah) ------------------------------------------------
  // Articles are saved as a JSON snapshot of the canonical Article so that the
  // in-app reader can render them offline with full topics / parsha label /
  // author portrait. The fetch+write is quick and has no byte-progress, so we
  // report `null` (indeterminate) until it completes.
  if (isArticle(content)) {
    options?.onProgress?.(null);
    const full = await resolveFullArticle(content);
    const path = await writeArticleSnapshot(full, fs.dirs.DocumentDir);
    const item = buildDownloadItem(full, path, ARTICLE_MIME, full.url);
    await saveDownloadedItem(item);
    options?.onProgress?.(1);
    return item;
  }

  // --- Anything else (currently unreachable: canDownloadContent gates) -------
  Alert.alert('Not downloadable', 'This content type cannot be saved offline.');
  return null;
};
