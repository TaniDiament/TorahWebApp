import { Alert, Platform, Share } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { Content, DownloadItem, DownloadKind, isArticle, isAudio } from '../types';

const { fs } = RNBlobUtil;
const MANIFEST_PATH = `${fs.dirs.DocumentDir}/torahweb-downloads.json`;

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

const getRemoteDownload = (content: Content) => {
  if (isAudio(content)) {
    return {
      url: content.audioUrl,
      extension: extensionFromUrl(content.audioUrl, 'm4a'),
      mime: 'audio/m4a',
    };
  }

  if (isArticle(content) && content.url) {
    return {
      url: content.url,
      extension: extensionFromUrl(content.url, 'html'),
      mime: 'text/html',
    };
  }

  return null;
};

const writeArticleText = async (content: Content, folder: string) => {
  if (!isArticle(content)) {
    throw new Error('Text fallback is only available for written articles.');
  }

  const fileName = `${sanitizeFileName(content.title) || content.id}.txt`;
  const path = `${folder}/${fileName}`;
  const body = `${content.title}\n\nBy ${content.author.name}\n${new Date(
    content.publishedDate,
  ).toLocaleDateString()}\n\n${content.content}`;

  await fs.writeFile(path, body, 'utf8');
  return path;
};

export const canDownloadContent = (content: Content) => isArticle(content) || isAudio(content);

export const getDownloadedItems = async (): Promise<DownloadItem[]> => {
  const items = await readManifest();
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
});

export const openDownloadedItem = async (item: DownloadItem) => {
  const exists = await fs.exists(item.filePath);
  if (!exists) {
    Alert.alert('File missing', 'This file no longer exists on your device.');
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

export const downloadContent = async (content: Content): Promise<DownloadItem | null> => {
  const remote = getRemoteDownload(content);
  const baseName = sanitizeFileName(content.title) || content.id;

  try {
    if (Platform.OS === 'android') {
      if (remote) {
        const path = `${fs.dirs.DownloadDir}/${baseName}.${remote.extension}`;

        await RNBlobUtil.config({
          path,
          addAndroidDownloads: {
            useDownloadManager: true,
            notification: true,
            mediaScannable: true,
            title: `${baseName}.${remote.extension}`,
            description: 'Downloading from TorahWeb',
            mime: remote.mime,
            path,
          },
        }).fetch('GET', remote.url);

        const item = buildDownloadItem(content, path, remote.mime, remote.url);
        await saveDownloadedItem(item);

        Alert.alert('Download started', 'You can track progress in the Downloads app.');
        return item;
      }

      const articlePath = await writeArticleText(content, fs.dirs.DownloadDir);
      const item = buildDownloadItem(content, articlePath, 'text/plain');
      await saveDownloadedItem(item);
      Alert.alert('Saved', `Saved to ${articlePath}`);
      return item;
    }

    const destination = remote
      ? `${fs.dirs.DocumentDir}/${baseName}.${remote.extension}`
      : await writeArticleText(content, fs.dirs.DocumentDir);

    if (remote) {
      await RNBlobUtil.config({ path: destination }).fetch('GET', remote.url);
    }

    const item = buildDownloadItem(
      content,
      destination,
      remote?.mime ?? 'text/plain',
      remote?.url,
    );
    await saveDownloadedItem(item);

    await Share.share({
      url: `file://${destination}`,
      title: baseName,
      message: baseName,
    });
    return item;
  } catch (error) {
    console.error('Download failed:', error);
    Alert.alert('Download failed', 'Please try again in a moment.');
    return null;
  }
};

