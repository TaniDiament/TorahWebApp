import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import { Author, Content, ContentType } from '../types';
import { api } from '../services/api';
import ArticleCard from '../components/ArticleCard';
import AuthorButton from '../components/AuthorButton';
import ErrorView from '../components/ErrorView';
import { Palette, radii, spacing, typography, useTheme, useThemedStyles } from '../theme';
import { GlassSurface } from '../components/ui/Glass';
import Icon from '../components/ui/Icon';
import { canDownloadContent, downloadContent } from '../services/download';
import { useDownloads } from '../downloads/DownloadsProvider';
import type {
  HomeStackParamList,
  RootTabParamList,
  SearchStackParamList,
} from '../navigation/types';
import { useScreenChromeInsets } from '../navigation/chromeInsets';

type Filter = ContentType | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'article', label: 'Divrei Torah' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
];

// SearchScreen is registered in both the Home stack (when pushed via a
// drill-in like Audio / a topic) and the Search tab's stack (as the
// always-present root). Both register a "Content" route with the same
// param shape, so typing against either stack works at runtime — but a
// union of the two NavigationProp types is structurally too narrow for
// the navigate overloads. Pick one (HomeStack) to satisfy the compiler;
// the runtime behavior is identical because the param contract matches.
type Nav = NativeStackNavigationProp<HomeStackParamList, 'Search'>;
type SearchRouteFromHome = RouteProp<HomeStackParamList, 'Search'>;
type SearchRouteFromTab = RouteProp<SearchStackParamList, 'SearchRoot'>;

const SearchScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<SearchRouteFromHome | SearchRouteFromTab>();
  const chrome = useScreenChromeInsets();
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { savedItems, saveContent, removeSaved } = useDownloads();
  // Audio is downloadable; divrei Torah and video can only be saved to the
  // Library (a bookmark toggle). Returns the matching ArticleCard props.
  const cardActions = (item: Content) => {
    if (canDownloadContent(item)) {
      return { onDownloadPress: async () => { await downloadContent(item); } };
    }
    const saved = savedItems.some((s) => s.contentId === item.id);
    return {
      saved,
      onSavePress: () => (saved ? removeSaved(item.id) : saveContent(item)),
    };
  };
  const params = route.params ?? {};
  const initialAuthorId = params.authorId;
  const initialTopicSlug = params.topicSlug;
  const initialParshaLabel = params.parshaLabel;
  const initialContentType = params.contentType;
  const showAllOnMount = params.showAll;
  const headerTitle = params.title;
  // A single parsha / yom tov is a pure browse list (the leaf of the Parsha /
  // Yom Tov menus) — no search box or media filters, matching the website.
  const browseMode = !!initialParshaLabel;
  // Search results are hydrated from content.json summaries and may be
  // missing type-specific fields. Push via the deep-link form so
  // ContentScreen fetches the full per-item record.
  const onContentSelect = (content: Content) =>
    navigation.navigate('Content', { contentId: content.id, contentKind: content.kind });

  const [query, setQuery] = useState('');
  // `query` drives the (always-responsive) text field; `debouncedQuery` is what
  // actually runs a search. See the debounce effect below.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(initialContentType ?? 'all');
  const [results, setResults] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Bumped by the retry button to re-run the load effect.
  const [reloadKey, setReloadKey] = useState(0);

  // Authors are loaded once so a free-text query can surface a matching speaker
  // as a tappable circle above the results (like Home's speaker row).
  const [authors, setAuthors] = useState<Author[]>([]);
  useEffect(() => {
    let active = true;
    api
      .getAuthors()
      .then((list) => {
        if (active) setAuthors(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Only on a plain free-text search (≥2 chars) — not the scoped author / topic
  // / parsha browse pages, which are already a single facet.
  const matchedAuthors = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (q.length < 2 || browseMode || initialAuthorId || initialTopicSlug || initialParshaLabel) {
      return [];
    }
    return authors.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 12);
  }, [authors, debouncedQuery, browseMode, initialAuthorId, initialTopicSlug, initialParshaLabel]);

  // Open the speaker's full content list. Hop through the parent tab navigator
  // to the Search tab's root (the same path ContentScreen uses for author
  // links), so this works from any stack SearchScreen is mounted in.
  const onAuthorPress = (author: Author) =>
    navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate('SearchTab', {
      screen: 'SearchRoot',
      params: { authorId: author.id, title: author.name },
    });

  // Debounce the free-text query so a search (index load + BM25 scoring +
  // hydrating the whole result set) doesn't fire on every keystroke. Discrete
  // actions — filter chips, author/topic/parsha entry — stay immediate; only
  // typing is debounced. Clearing the box commits instantly so stale results
  // don't linger behind a 250 ms delay.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setDebouncedQuery('');
      return;
    }
    const id = setTimeout(() => setDebouncedQuery(trimmed), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        let next: Content[];
        if (initialAuthorId) {
          next = await api.getContentByAuthor(initialAuthorId);
        } else if (initialTopicSlug) {
          next = await api.getContentByTopic(initialTopicSlug);
        } else if (initialParshaLabel) {
          next = await api.getContentByParsha(initialParshaLabel);
        } else if (debouncedQuery.length > 0 || filter !== 'all' || showAllOnMount) {
          next = await api.searchContent({
            query: debouncedQuery || undefined,
            contentType: filter === 'all' ? undefined : filter,
          });
        } else {
          next = [];
        }
        if (cancelled) return;
        // searchContent already filters by contentType, but
        // getContentByAuthor / getContentByTopic return every kind for that
        // facet — re-apply the filter here so the chip selection is honored
        // on those paths too.
        const typed =
          filter === 'all' ? next : next.filter((item) => item.kind === filter);
        const hasQuery = debouncedQuery.length > 0;
        const sorted = hasQuery
          ? typed
          : [...typed].sort(
              (a, b) =>
                new Date(b.publishedDate).getTime() -
                new Date(a.publishedDate).getTime(),
            );
        setResults(sorted);
      } catch (e) {
        if (cancelled) return;
        console.error('Search failed:', e);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, filter, initialAuthorId, initialTopicSlug, initialParshaLabel, showAllOnMount, reloadKey]);

  // True while the user has typed something the debounce hasn't committed yet,
  // so the empty slot shows a spinner instead of flashing "No results."
  const pending = query.trim().length > 0 && query.trim() !== debouncedQuery;

  return (
    <View style={styles.container}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingTop: chrome.top, paddingBottom: chrome.bottom },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.largeTitle}>{headerTitle ?? 'Search'}</Text>
            {/* Browse mode (a single parsha / yom tov) is a plain list — no
                search field, matching the website's parsha pages. */}
            {browseMode ? null : (
              <GlassSurface
                variant="regular"
                cornerRadius={radii.md}
                style={styles.searchBox}>
                <View style={styles.searchInner}>
                  <Icon name="magnifyingglass" size={18} color={c.textTertiary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Shiurim, speakers, parshiyot…"
                    placeholderTextColor={c.textTertiary}
                    value={query}
                    onChangeText={setQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    accessibilityLabel="Search"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  {query.length > 0 ? (
                    <Pressable
                      onPress={() => setQuery('')}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel="Clear search">
                      <Icon name="xmark" size={16} color={c.textTertiary} />
                    </Pressable>
                  ) : null}
                </View>
              </GlassSurface>
            )}

            {/* When the screen is opened with a preset content type (the
                Audio / Video / Divrei Torah quick chips on Home), the page
                is already scoped — surfacing the All/Article/Video/Audio
                chips would just let the user undo the filter they came in
                with. Show only the search bar and the results list. */}
            {initialContentType || browseMode ? null : (
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
            )}

            {/* A query that matches a speaker surfaces them as circles up top,
                before the article results — the quickest path to their page. */}
            {matchedAuthors.length > 0 ? (
              <View style={styles.authorSection}>
                <Text style={styles.authorHeading}>Speakers</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.authorRow}>
                  {matchedAuthors.map((author) => (
                    <AuthorButton
                      key={author.id}
                      author={author}
                      onPress={() => onAuthorPress(author)}
                      variant="circle"
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ArticleCard
            content={item}
            onPress={() => onContentSelect(item)}
            {...cardActions(item)}
          />
        )}
        ListEmptyComponent={
          loading || pending ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={c.accent} />
            </View>
          ) : error ? (
            // Only reached when the failed load left nothing to show; a failed
            // refresh over existing results keeps the stale list instead.
            <ErrorView
              icon="wifi.slash"
              title="Couldn't load"
              message="Check your connection and try again."
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          ) : (
            <View style={styles.empty}>
              <Icon name="magnifyingglass" size={48} color={c.textTertiary} />
              <Text style={styles.emptyText}>
                {debouncedQuery.length > 0
                  ? 'No results.'
                  : browseMode
                    ? 'Nothing here yet.'
                    : 'Search by author, topic, or keyword.'}
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
}> = ({ label, active, onPress }) => {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      android_ripple={{ color: c.ripple, borderless: false }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.7 },
      ]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  list: {
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
    // paddingTop / paddingBottom set at runtime from useScreenChromeInsets.
  },
  header: {
    marginBottom: spacing.md,
  },
  largeTitle: {
    ...typography.largeTitle,
    color: c.text,
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
    color: c.text,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  authorSection: {
    marginTop: spacing.md,
  },
  authorHeading: {
    ...typography.footnote,
    fontWeight: '700',
    color: c.textTertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  authorRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: c.surfaceTint,
  },
  chipActive: {
    backgroundColor: c.navy,
  },
  chipText: {
    ...typography.footnote,
    fontWeight: '600',
    color: c.text,
  },
  chipTextActive: {
    color: c.textInverse,
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
    color: c.textTertiary,
    textAlign: 'center',
  },
});

export default SearchScreen;
