import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Content, ContentType } from '../types';
import { api } from '../services/api';
import ArticleCard from '../components/ArticleCard';
import { colors, liquidGlass, radii, spacing, typography } from '../theme';
import { GlassButton, GlassSurface } from '../components/ui/Glass';

interface SearchScreenProps {
  initialAuthorId?: string;
  initialTopicSlug?: string;
  initialContentType?: ContentType;
  showAllOnMount?: boolean;
  headerTitle?: string;
  onContentSelect: (content: Content) => void;
}

type Filter = ContentType | 'all';

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

  const renderFilter = (f: Filter, label: string) => (
    <GlassButton
      key={f}
      style={[styles.filterButton, filter === f && styles.filterButtonActive]}
      contentStyle={[
        styles.filterButtonInner,
        filter === f && styles.filterButtonInnerActive,
      ]}
      onPress={() => setFilter(f)}>
      <Text
        style={[
          styles.filterButtonText,
          filter === f && styles.filterButtonTextActive,
        ]}>
        {label}
      </Text>
    </GlassButton>
  );

  return (
    <View style={styles.container}>
      {headerTitle ? (
        <GlassSurface style={styles.pageHeader}>
          <Text style={styles.pageHeaderText}>{headerTitle}</Text>
        </GlassSurface>
      ) : null}

      <GlassSurface style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder="Search divrei Torah, shiurim, speakers…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </GlassSurface>

      <GlassSurface style={styles.filters}>
        {renderFilter('all', 'All')}
        {renderFilter('article', 'Divrei Torah')}
        {renderFilter('video', 'Video')}
        {renderFilter('audio', 'Audio')}
      </GlassSurface>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ArticleCard content={item} onPress={() => onContentSelect(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {query.length > 0
                  ? 'No results.'
                  : 'Browse by author, topic, or start typing to search.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageHeader: {
    ...liquidGlass.header,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  pageHeaderText: {
    ...typography.sectionTitle,
    color: liquidGlass.textOnGlass,
  },
  searchBox: {
    padding: spacing.lg,
    ...liquidGlass.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.45)',
  },
  input: {
    height: 46,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.textPrimary,
    ...liquidGlass.input,
  },
  filters: {
    flexDirection: 'row',
    ...liquidGlass.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterButton: {
    borderRadius: radii.sm,
    marginRight: spacing.sm,
  },
  filterButtonInner: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    ...liquidGlass.chip,
    borderRadius: radii.sm,
  },
  filterButtonActive: {
    borderRadius: radii.sm,
  },
  filterButtonInnerActive: {
    ...liquidGlass.buttonPrimary,
  },
  filterButtonText: {
    ...typography.caption,
    color: liquidGlass.subtleTextOnGlass,
  },
  filterButtonTextActive: {
    color: liquidGlass.textOnPrimaryGlass,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: spacing.lg,
  },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default SearchScreen;
