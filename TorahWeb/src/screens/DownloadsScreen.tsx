import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { DownloadItem } from '../types';
import { colors, radii, shadows, spacing, typography } from '../theme';
import {
  getDownloadedItems,
  openDownloadedItem,
  removeDownloadedItem,
} from '../services/download';
import Icon from '../components/ui/Icon';

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

  const onDeletePress = async () => {
    await onDelete(item);
    swipeRef.current?.close();
  };

  const renderRightAction = () => (
    <View style={styles.swipeActionWrap}>
      <Pressable
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
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: 0.85 },
        ]}>
        <View style={styles.kindBadge}>
          <Icon name={kindIcon(item.kind) as any} size={20} color={colors.textInverse} />
        </View>
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
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        <DownloadRow item={item} onOpen={openDownloadedItem} onDelete={onRemove} />
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
