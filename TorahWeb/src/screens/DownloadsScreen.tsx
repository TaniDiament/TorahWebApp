import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { DownloadItem } from '../types';
import { colors, liquidGlass, radii, spacing, typography } from '../theme';
import {
  getDownloadedItems,
  openDownloadedItem,
  removeDownloadedItem,
} from '../services/download';
import { GlassSurface } from '../components/ui/Glass';

const formatDate = (value: string) => new Date(value).toLocaleDateString();

interface DownloadRowProps {
  item: DownloadItem;
  onOpen: (item: DownloadItem) => void;
  onDelete: (item: DownloadItem) => Promise<void>;
}

const DownloadRow: React.FC<DownloadRowProps> = ({ item, onOpen, onDelete }) => {
  const swipeRef = useRef<Swipeable | null>(null);

  const onDeletePress = async () => {
    await onDelete(item);
    swipeRef.current?.close();
  };

  const renderRightAction = () => (
    <View style={styles.swipeActionWrap}>
      <TouchableOpacity
        style={styles.swipeDeleteAction}
        onPress={onDeletePress}
        activeOpacity={0.85}>
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      rightThreshold={24}
      friction={Platform.OS === 'ios' ? 1.6 : 1.9}
      renderRightActions={renderRightAction}>
      <GlassSurface style={styles.row}>
        <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.authorName} - {formatDate(item.publishedDate)}
        </Text>
        <Text style={styles.meta}>Saved {formatDate(item.createdAt)}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.openButton]}
            onPress={() => onOpen(item)}
            activeOpacity={0.85}>
            <Text style={styles.actionText}>Open</Text>
          </TouchableOpacity>
        </View>
      </GlassSurface>
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
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <DownloadRow item={item} onOpen={openDownloadedItem} onDelete={onRemove} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No downloads yet</Text>
            <Text style={styles.emptyText}>
              Use the DOWNLOAD button on an article or audio shiur and it will appear here.
            </Text>
          </View>
        }
      />
    </View>
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  row: {
    ...liquidGlass.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  swipeActionWrap: {
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  swipeDeleteAction: {
    ...liquidGlass.buttonDestructive,
    width: 110,
    height: '86%',
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDeleteText: {
    ...typography.eyebrow,
    color: liquidGlass.destructiveTextOnGlass,
  },
  kind: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.cardTitle,
    color: liquidGlass.textOnGlass,
    marginBottom: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: liquidGlass.subtleTextOnGlass,
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    ...liquidGlass.button,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  openButton: {
    ...liquidGlass.buttonPrimary,
  },
  actionText: {
    ...typography.caption,
    fontWeight: '700',
    color: liquidGlass.textOnGlass,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: liquidGlass.textOnGlass,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: liquidGlass.subtleTextOnGlass,
    textAlign: 'center',
  },
});

export default DownloadsScreen;

