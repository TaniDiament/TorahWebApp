import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Content, DownloadItem } from '../types';
import type { LibraryStackParamList } from '../navigation/types';
import { colors, radii, shadows, spacing, typography } from '../theme';
import {
  getDownloadedItems,
  loadDownloadedArticle,
  openDownloadedItem,
  removeDownloadedItem,
} from '../services/download';
import Icon from '../components/ui/Icon';
import { useAudioPlayer } from '../audio/AudioPlayerProvider';

type Nav = NativeStackNavigationProp<LibraryStackParamList, 'Library'>;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

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

const DownloadRow: React.FC<DownloadRowProps> = ({ item, onOpen, onDelete }) => {
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
        <Icon name="xmark" size={20} color={colors.textInverse} />
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
        android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: 0.85 },
        ]}>
        {item.artworkUrl ? (
          <Image source={{ uri: item.artworkUrl }} style={styles.portrait} />
        ) : (
          <View style={styles.kindBadge}>
            <Icon name={kindIcon(item.kind) as any} size={20} color={colors.textInverse} />
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.authorName} · {formatDate(item.publishedDate)}
          </Text>
        </View>
        <Icon name="chevron.right" size={18} color={colors.textTertiary} />
      </Pressable>
    </Swipeable>
  );
};

const DownloadsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { playTrack, expand } = useAudioPlayer();
  const onContentSelect = (content: Content) =>
    navigation.navigate('Content', { content });

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
          onContentSelect(article);
          return;
        }
        // Legacy article downloads (pre-snapshot format) fall through to the
        // OS hand-off in openDownloadedItem.
      }

      await openDownloadedItem(item);
    },
    [expand, navigation, playTrack],
  );

  const load = useCallback(async () => {
    const next = await getDownloadedItems();
    setItems(next);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const onRemove = async (item: DownloadItem) => {
    await removeDownloadedItem(item);
    await load();
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.largeTitle}>Library</Text>
          <Text style={styles.subtitle}>{items.length} downloaded</Text>
        </View>
      }
      renderItem={({ item }) => (
        <DownloadRow item={item} onOpen={onOpen} onDelete={onRemove} />
      )}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Icon name="rectangle.stack.fill" size={56} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Nothing downloaded</Text>
          <Text style={styles.emptyText}>
            Tap the download icon on any item to keep it here for offline.
          </Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  listContent: {
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  largeTitle: {
    ...typography.largeTitle,
    color: colors.text,
  },
  subtitle: {
    ...typography.subheadline,
    color: colors.textSecondary,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  kindBadge: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portrait: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceTint,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  kind: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  title: {
    ...typography.headline,
    color: colors.text,
  },
  meta: {
    ...typography.subheadline,
    color: colors.textSecondary,
    marginTop: 2,
  },
  swipeActionWrap: {
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  swipeDeleteAction: {
    backgroundColor: colors.destructive,
    width: 96,
    height: '86%',
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeDeleteText: {
    ...typography.caption,
    color: colors.textInverse,
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
    color: colors.text,
  },
  emptyText: {
    ...typography.subheadline,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default DownloadsScreen;
