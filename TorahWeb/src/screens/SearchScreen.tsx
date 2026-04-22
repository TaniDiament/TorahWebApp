import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Content, ContentType } from '../types';
import { api } from '../services/api';
import ArticleCard from '../components/ArticleCard';
import { colors, radii, spacing, typography } from '../theme';
import { GlassSurface } from '../components/ui/Glass';
import Icon from '../components/ui/Icon';
import { canDownloadContent, downloadContent } from '../services/download';

interface SearchScreenProps {
  initialAuthorId?: string;
  initialTopicSlug?: string;
  initialContentType?: ContentType;
  showAllOnMount?: boolean;
  headerTitle?: string;
  onContentSelect: (content: Content) => void;
}

type Filter = ContentType | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'article', label: 'Divrei Torah' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
];

const SearchScreen: React.FC<SearchScreenProps> = ({
  initialAuthorId,
  initialTopicSlug,
  initialContentType,
  showAllOnMount,
  headerTitle,
  onContentSelect,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(initialContentType ?? 'all');
  const [results, setResults] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let next: Content[];
        if (initialAuthorId) {
          next = await api.getContentByAuthor(initialAuthorId);
        } else if (initialTopicSlug) {
          next = await api.getContentByTopic(initialTopicSlug);
        } else if (query.trim().length > 0 || filter !== 'all' || showAllOnMount) {
          next = await api.searchContent({
            query: query.trim() || undefined,
            contentType: filter === 'all' ? undefined : filter,
          });
        } else {
          next = [];
        }
        if (cancelled) return;
        const typed =
          filter === 'all'
            ? next
            : next.filter((c) => {
                if (filter === 'article') return 'content' in c;
                if (filter === 'video') return 'vimeoId' in c || 'videoUrl' in c;
                if (filter === 'audio')
                  return 'audioUrl' in c && !('videoUrl' in c) && !('vimeoId' in c);
                return true;
              });
        const sorted = [...typed].sort(
          (a, b) =>
            new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime(),
        );
        setResults(sorted);
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, filter, initialAuthorId, initialTopicSlug, showAllOnMount]);

  return (
    <View style={styles.container}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.largeTitle}>{headerTitle ?? 'Search'}</Text>
            <GlassSurface
              variant="regular"
              cornerRadius={radii.md}
              style={styles.searchBox}>
              <View style={styles.searchInner}>
                <Icon name="magnifyingglass" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="Shiurim, speakers, parshiyot…"
                  placeholderTextColor={colors.textTertiary}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query.length > 0 ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <Icon name="xmark" size={16} color={colors.textTertiary} />
                  </Pressable>
                ) : null}
              </View>
            </GlassSurface>

            <View style={styles.filterRow}>
              {FILTERS.map((f) => (
                <FilterChip
                  key={f.id}
                  label={f.label}
                  active={filter === f.id}
                  onPress={() => setFilter(f.id)}
                />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ArticleCard
            content={item}
            onPress={() => onContentSelect(item)}
            onDownloadPress={
              canDownloadContent(item)
                ? async () => {
                    await downloadContent(item);
                  }
                : undefined
            }
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.navy} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Icon name="magnifyingglass" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>
                {query.length > 0 ? 'No results.' : 'Search by author, topic, or keyword.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
};

const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
}> = ({ label, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.chip,
      active && styles.chipActive,
      pressed && { opacity: 0.7 },
    ]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  header: {
    marginBottom: spacing.md,
  },
  largeTitle: {
    ...typography.largeTitle,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchBox: {
    height: 44,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  searchInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceTint,
  },
  chipActive: {
    backgroundColor: colors.navy,
  },
  chipText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.text,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default SearchScreen;
