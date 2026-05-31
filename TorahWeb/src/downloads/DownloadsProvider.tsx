import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { Content, DownloadItem, DownloadKind, isAudio } from '../types';
import {
  downloadContent,
  getDownloadedItems,
  removeDownloadedItem,
} from '../services/download';

// A download that's currently fetching (or just failed) — shown at the top of
// the Library with a live progress ring, Apple-Podcasts style, before it lands
// in the on-disk manifest as a completed DownloadItem.
export interface ActiveDownload {
  contentId: string;
  title: string;
  authorName: string;
  publishedDate: string;
  kind: DownloadKind;
  artworkUrl?: string;
  // 0..1 fractional progress, or null when the total size isn't known yet
  // (article snapshots, or audio whose server omits Content-Length).
  progress: number | null;
  status: 'downloading' | 'error';
}

interface DownloadsContextValue {
  // Completed, on-disk downloads (newest first), mirrored from the manifest.
  items: DownloadItem[];
  // In-flight / failed downloads, newest-tapped first.
  activeDownloads: ActiveDownload[];
  // True only during the initial manifest read on launch.
  loading: boolean;
  // Kick off a download. Returns immediately — the item shows up in
  // activeDownloads right away and moves to `items` when it finishes.
  startDownload: (content: Content) => void;
  // Drop a failed (or stuck) active entry from the list.
  dismissActive: (contentId: string) => void;
  // Re-read the on-disk manifest.
  refresh: () => Promise<void>;
  removeItem: (item: DownloadItem) => Promise<void>;
}

const DownloadsContext = createContext<DownloadsContextValue | undefined>(undefined);

const toKind = (content: Content): DownloadKind => (isAudio(content) ? 'audio' : 'article');

export const DownloadsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<DownloadItem[]>([]);
  // Keyed by contentId so a repeated tap on the same item is a no-op and
  // progress patches target the right row. Insertion order is preserved.
  const [active, setActive] = useState<Record<string, ActiveDownload>>({});
  const [loading, setLoading] = useState(true);

  // Mirror `active` into a ref so startDownload can guard against duplicate
  // taps without depending on (and thus re-creating itself on) every progress
  // tick.
  const activeRef = useRef(active);
  activeRef.current = active;

  const refresh = useCallback(async () => {
    const next = await getDownloadedItems();
    setItems(next);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const patchActive = useCallback((contentId: string, patch: Partial<ActiveDownload>) => {
    setActive((prev) => {
      const cur = prev[contentId];
      if (!cur) return prev;
      return { ...prev, [contentId]: { ...cur, ...patch } };
    });
  }, []);

  const dismissActive = useCallback((contentId: string) => {
    setActive((prev) => {
      if (!prev[contentId]) return prev;
      const next = { ...prev };
      delete next[contentId];
      return next;
    });
  }, []);

  const startDownload = useCallback(
    (content: Content) => {
      const contentId = content.id;
      // Ignore a repeat tap while this exact item is already downloading.
      if (activeRef.current[contentId]?.status === 'downloading') return;

      setActive((prev) => ({
        ...prev,
        [contentId]: {
          contentId,
          title: content.title,
          authorName: content.author.name,
          publishedDate: content.publishedDate,
          kind: toKind(content),
          artworkUrl: content.author.portraitUrl,
          progress: null,
          status: 'downloading',
        },
      }));

      (async () => {
        try {
          await downloadContent(content, {
            onProgress: (ratio) => patchActive(contentId, { progress: ratio }),
          });
          // Done — drop the in-flight row and surface it from the manifest.
          dismissActive(contentId);
          await refresh();
        } catch (err) {
          console.error('Download failed:', err);
          patchActive(contentId, { status: 'error' });
          Alert.alert('Download failed', 'Please try again in a moment.');
        }
      })();
    },
    [dismissActive, patchActive, refresh],
  );

  const removeItem = useCallback(
    async (item: DownloadItem) => {
      await removeDownloadedItem(item);
      await refresh();
    },
    [refresh],
  );

  // Newest tap first so a just-started download appears at the top of Library.
  const activeDownloads = useMemo(() => Object.values(active).reverse(), [active]);

  const value = useMemo<DownloadsContextValue>(
    () => ({
      items,
      activeDownloads,
      loading,
      startDownload,
      dismissActive,
      refresh,
      removeItem,
    }),
    [items, activeDownloads, loading, startDownload, dismissActive, refresh, removeItem],
  );

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
};

export const useDownloads = () => {
  const ctx = useContext(DownloadsContext);
  if (!ctx) {
    throw new Error('useDownloads must be used within DownloadsProvider');
  }
  return ctx;
};
