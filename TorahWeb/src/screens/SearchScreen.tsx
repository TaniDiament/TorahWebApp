import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Content, ContentType } from '../types';
import { api } from '../services/api';
import ArticleCard from '../components/ArticleCard';
import { colors, radii, spacing, typography } from '../theme';

interface SearchScreenProps {
  initialAuthorId?: string;
  initialTopicSlug?: string;
  headerTitle?: string;
  onContentSelect: (content: Content) => void;
}

type Filter = ContentType | 'all';

const SearchScreen: React.FC<SearchScreenProps> = ({
  initialAuthorId,
  initialTopicSlug,
  headerTitle,
  onContentSelect,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
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
        } else if (query.trim().length > 0 || filter !== 'all') {
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
        setResults(typed);
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, filter, initialAuthorId, initialTopicSlug]);

  const renderFilter = (f: Filter, label: string) => (
    <TouchableOpacity
      key={f}
      style={[styles.filterButton, filter === f && styles.filterButtonActive]}
      onPress={() => setFilter(f)}>
      <Text
        style={[
          styles.filterButtonText,
          filter === f && styles.filterButtonTextActive,
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {headerTitle ? (
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderText}>{headerTitle}</Text>
        </View>
      ) : null}

      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder="Search divrei Torah, shiurim, speakers…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.filters}>
        {renderFilter('all', 'All')}
        {renderFilter('article', 'Divrei Torah')}
        {renderFilter('video', 'Video')}
        {renderFilter('audio', 'Audio')}
      </View>

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
    backgroundColor: colors.navy,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  pageHeaderText: {
    ...typography.sectionTitle,
    color: colors.surface,
  },
  searchBox: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.navy,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  filters: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: '#ececec',
  },
  filterButtonActive: {
    backgroundColor: colors.navy,
  },
  filterButtonText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterButtonTextActive: {
    color: colors.surface,
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
