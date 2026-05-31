import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DownloadItem } from '../types';
import type { LibraryStackParamList } from '../navigation/types';
import { Palette, radii, shadows, spacing, typography, useTheme, useThemedStyles } from '../theme';
import { loadDownloadedArticle, openDownloadedItem } from '../services/download';
import { ActiveDownload, useDownloads } from '../downloads/DownloadsProvider';
import Icon from '../components/ui/Icon';
import CircularProgress from '../components/ui/CircularProgress';
import { useAudioPlayer } from '../audio/AudioPlayerProvider';
import { useScreenChromeInsets } from '../navigation/chromeInsets';

type Nav = NativeStackNavigationProp<LibraryStackParamList, 'Library'>;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// The Library list interleaves in-flight downloads (top) with completed ones.
type LibraryRow =
  | { type: 'active'; key: string; download: ActiveDownload }
  | { type: 'done'; key: string; item: DownloadItem };

interface DownloadRowProps {
  item: DownloadItem;
  onOpen: (item: DownloadItem) => void;
  onDelete: (item: DownloadItem) => Promise<void>;
}

const kindIcon = (kind: string) => {
  if (kind === 'audio') return 'waveform';
  if (kind === 'video') return 'video.fill';
  return 'doc.text.fill';
};

// A still-downloading (or just-failed) row: same layout as a completed row but
// with a live progress ring where the chevron would be, Apple-Podcasts style.
interface ActiveDownloadRowProps {
  download: ActiveDownload;
  onDismiss: (contentId: string) => void;
}

const ActiveDownloadRow: React.FC<ActiveDownloadRowProps> = ({ download, onDismiss }) => {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const failed = download.status === 'error';
  // Indeterminate (article snapshot / unknown size) shows a spinner; a known
  // ratio drives the ring.
  const indeterminate = download.progress == null;

  const body = (
    <>
      {download.artworkUrl ? (
        <Image source={{ uri: download.artworkUrl }} style={styles.portrait} />
      ) : (
        <View style={styles.kindBadge}>
          <Icon name={kindIcon(download.kind) as any} size={20} color={c.textInverse} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.kind}>{download.kind.toUpperCase()}</Text>
        <Text style={styles.title} numberOfLines={2}>{download.title}</Text>
        <Text style={[styles.meta, failed && styles.metaError]} numberOfLines={1}>
          {failed
            ? 'Download failed · Tap to dismiss'
            : indeterminate
              ? 'Downloading…'
              : `Downloading · ${Math.round((download.progress ?? 0) * 100)}%`}
        </Text>
      </View>
      <View style={styles.progressWrap}>
        {failed ? (
          <Icon name="exclamationmark.triangle" size={22} color={c.destructive} />
        ) : indeterminate ? (
          <ActivityIndicator color={c.accent} />
        ) : (
          <CircularProgress
            size={26}
            strokeWidth={3}
            progress={download.progress ?? 0}
            color={c.accent}
            trackColor={c.separator}
            innerColor={c.surface}
          />
        )}
      </View>
    </>
  );

  // Only a failed row is interactive (tap to clear it); an in-flight row just
  // shows progress.
  if (failed) {
    return (
      <Pressable
        onPress={() => onDismiss(download.contentId)}
        accessibilityRole="button"
        accessibilityLabel={`Dismiss failed download ${download.title}`}
        android_ripple={{ color: c.ripple, borderless: false }}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
        {body}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={`Downloading ${download.title}, ${Math.round((download.progress ?? 0) * 100)} percent`}
      style={styles.row}>
      {body}
    </View>
  );
};

const DownloadRow: React.FC<DownloadRowProps> = ({ item, onOpen, onDelete }) => {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const swipeRef = useRef<React.ElementRef<typeof Swipeable> | null>(null);

  const performDelete = async () => {
    try {
      await onDelete(item);
    } finally {
      // Some versions of ReanimatedSwipeable don't expose .close(); guard it.
      swipeRef.current?.close?.();
    }
  };

  const onDeletePress = () => {
    Alert.alert(
      'Delete this download?',
      `"${item.title}" will be removed from your device.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => swipeRef.current?.close?.(),
        },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ],
    );
  };

  const renderRightAction = () => (
    <View style={styles.swipeActionWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.title}`}
        android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
        style={({ pressed }) => [
          styles.swipeDeleteAction,
          pressed && { opacity: 0.85 },
        ]}
        onPress={onDeletePress}>
        <Icon name="xmark" size={20} color={c.textInverse} />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      rightThreshold={24}
      friction={Platform.OS === 'ios' ? 1.6 : 1.9}
      renderRightActions={renderRightAction}>
      <Pressable
        onPress={() => onOpen(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.title}, ${item.kind}, by ${item.authorName}`}
        accessibilityHint="Swipe left to delete"
        android_ripple={{ color: c.ripple, borderless: false }}
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: 0.85 },
        ]}>
        {item.artworkUrl ? (
          <Image source={{ uri: item.artworkUrl }} style={styles.portrait} />
        ) : (
          <View style={styles.kindBadge}>
            <Icon name={kindIcon(item.kind) as any} size={20} color={c.textInverse} />
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.authorName} · {formatDate(item.publishedDate)}
          </Text>
        </View>
        <Icon name="chevron.right" size={18} color={c.textTertiary} />
      </Pressable>
    </Swipeable>
  );
};

const DownloadsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const chrome = useScreenChromeInsets();
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { items, activeDownloads, loading, refresh, removeItem, dismissActive } = useDownloads();
  const [refreshing, setRefreshing] = useState(false);
  const { playTrack, expand } = useAudioPlayer();

  const onOpen = useCallback(
    async (item: DownloadItem) => {
      if (item.kind === 'audio') {
        try {
          await playTrack({
            id: item.contentId,
            // file:// URI keeps playback strictly local — TrackPlayer hands
            // this to ExoPlayer/AVPlayer in-process; the OS never gets a
            // chance to route it to a default audio app.
            url: `file://${item.filePath}`,
            title: item.title,
            artist: item.authorName,
            artworkUrl: item.artworkUrl,
          });
          expand();
        } catch (err) {
          const message =
            err instanceof Error && err.message ? err.message : 'Please try again.';
          Alert.alert("Couldn't play audio", message);
        }
        return;
      }

      if (item.kind === 'article') {
        const article = await loadDownloadedArticle(item);
        if (article) {
          navigation.navigate('Content', { content: article });
          return;
        }
        // Legacy article downloads (pre-snapshot format) fall through to the
        // OS hand-off in openDownloadedItem.
      }

      await openDownloadedItem(item);
    },
    [expand, navigation, playTrack],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Active downloads ride at the top so a just-tapped item is the first thing
  // the user sees when they land on the Library; completed downloads follow.
  // A content id that's still active is filtered out of the completed list so
  // the handoff at completion never momentarily shows the same item twice.
  const rows = useMemo<LibraryRow[]>(() => {
    const activeIds = new Set(activeDownloads.map((d) => d.contentId));
    return [
      ...activeDownloads.map((download) => ({
        type: 'active' as const,
        key: `active-${download.contentId}`,
        download,
      })),
      ...items
        .filter((item) => !activeIds.has(item.contentId))
        .map((item) => ({ type: 'done' as const, key: item.id, item })),
    ];
  }, [activeDownloads, items]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={rows}
      keyExtractor={(row) => row.key}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={[
        styles.listContent,
        { paddingTop: chrome.top, paddingBottom: chrome.bottom },
      ]}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.largeTitle}>Library</Text>
          <Text style={styles.subtitle}>
            {activeDownloads.length > 0
              ? `${activeDownloads.length} downloading · ${items.length} downloaded`
              : `${items.length} downloaded`}
          </Text>
        </View>
      }
      renderItem={({ item: row }) =>
        row.type === 'active' ? (
          <ActiveDownloadRow download={row.download} onDismiss={dismissActive} />
        ) : (
          <DownloadRow item={row.item} onOpen={onOpen} onDelete={removeItem} />
        )
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Icon name="rectangle.stack.fill" size={56} color={c.textTertiary} />
          <Text style={styles.emptyTitle}>Nothing downloaded</Text>
          <Text style={styles.emptyText}>
            Tap the download icon on any item to keep it here for offline.
          </Text>
        </View>
      }
    />
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
    // paddingTop / paddingBottom set at runtime from useScreenChromeInsets.
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  largeTitle: {
    ...typography.largeTitle,
    color: c.text,
  },
  subtitle: {
    ...typography.subheadline,
    color: c.textSecondary,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  kindBadge: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: c.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portrait: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: c.surfaceTint,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  kind: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: c.textTertiary,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  title: {
    ...typography.headline,
    color: c.text,
  },
  meta: {
    ...typography.subheadline,
    color: c.textSecondary,
    marginTop: 2,
  },
  metaError: {
    color: c.destructive,
  },
  // Fixed-width slot so the progress ring sits exactly where the completed
  // row's chevron does, keeping the two row types visually aligned.
  progressWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeActionWrap: {
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  swipeDeleteAction: {
    backgroundColor: c.destructive,
    width: 96,
    height: '86%',
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeDeleteText: {
    ...typography.caption,
    color: c.textInverse,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.title2,
    color: c.text,
  },
  emptyText: {
    ...typography.subheadline,
    color: c.textTertiary,
    textAlign: 'center',
  },
});

export default DownloadsScreen;
