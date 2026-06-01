import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Author, Content, EventFlier, Topic } from '../types';
import { api } from '../services/api';
import AuthorButton from '../components/AuthorButton';
import TopicButton from '../components/TopicButton';
import ArticleCard from '../components/ArticleCard';
import EventBanner from '../components/EventBanner';
import ErrorView from '../components/ErrorView';
import { Palette, radii, spacing, typography, useTheme, useThemedStyles } from '../theme';
import { GlassButton } from '../components/ui/Glass';
import Icon, { IconName } from '../components/ui/Icon';
import { canDownloadContent, downloadContent } from '../services/download';
import { useDownloads } from '../downloads/DownloadsProvider';
import type { HomeStackParamList, MenuRouteParams } from '../navigation/types';
import { useScreenChromeInsets } from '../navigation/chromeInsets';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const chrome = useScreenChromeInsets();
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { savedItems, saveContent, removeSaved } = useDownloads();
  // A card's trailing action depends on the content type: audio is downloadable,
  // while divrei Torah and video can only be saved to the Library (a bookmark
  // toggle). Returns the matching ArticleCard props.
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
  const onAuthorPress = (author: Author) =>
    navigation.navigate('Search', { authorId: author.id, title: author.name });
  // Parsha and Yom Tov open the torahweb.org-style drill-down menus
  // (chumash → parsha, or list of yomim tovim) instead of dumping every
  // tagged item into one flat list. Other topics keep the flat topic view.
  const onTopicPress = (topic: Topic) => {
    if (topic.slug === 'parsha') {
      const params: MenuRouteParams = { menu: 'parshaBooks', title: topic.name };
      navigation.navigate('Menu', params);
      return;
    }
    if (topic.slug === 'yomtov') {
      const params: MenuRouteParams = { menu: 'yomtov', title: topic.name };
      navigation.navigate('Menu', params);
      return;
    }
    navigation.navigate('Search', { topicSlug: topic.slug, title: topic.name });
  };
  // Always go through the deep-link form so ContentScreen fetches the full
  // per-item record. List-derived Content can be a hydrated skeleton missing
  // type-specific fields (article body, audioUrl, vimeoId) — the fetch path
  // is the source of truth.
  const onArticlePress = (content: Content) =>
    navigation.navigate('Content', { contentId: content.id, contentKind: content.kind });
  const onAudioPress = () =>
    navigation.navigate('Search', { contentType: 'audio', title: 'Audio' });
  const onVideoPress = () =>
    navigation.navigate('Search', { contentType: 'video', title: 'Video' });
  const onDivreiTorahPress = () =>
    navigation.navigate('Search', { contentType: 'article', title: 'Divrei Torah' });
  const onNewestPress = () => navigation.navigate('Search', { showAll: true, title: 'Newest' });
  const onDownloadsPress = () =>
    navigation.getParent()?.navigate('LibraryTab' as never);

  const [authors, setAuthors] = useState<Author[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [recent, setRecent] = useState<Content[]>([]);
  const [event, setEvent] = useState<EventFlier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Bumped by the retry button to re-run the load effect.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const [a, t, r, e] = await Promise.all([
          api.getAuthors(),
          api.getTopics(),
          api.getRecent(3),
          api.getCurrentEvent(),
        ]);
        if (cancelled) return;
        setAuthors(a);
        setTopics(t);
        setRecent(r);
        setEvent(e);
      } catch (err) {
        if (cancelled) return;
        console.error('HomeScreen load failed:', err);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const onEventVideoPress = (videoContentId: string) =>
    navigation.navigate('Content', { contentId: videoContentId, contentKind: 'video' });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <ErrorView
          icon="wifi.slash"
          title="Couldn't load"
          message="Check your connection and try again."
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: chrome.bottom },
      ]}
      showsVerticalScrollIndicator={false}>
      {/* The banner sits at the top of the body area — App.tsx's
          SafeAreaView already supplies the status-bar inset, so no extra
          padding here. */}
      <EventBanner event={event} onTapVideo={onEventVideoPress} />
      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>TorahWeb</Text>
      </View>

      <View style={styles.quickRow}>
        <QuickChip label="Audio" icon="waveform" onPress={onAudioPress} />
        <QuickChip label="Video" icon="video.fill" onPress={onVideoPress} />
        <QuickChip label="Divrei Torah" icon="torah.scroll" onPress={onDivreiTorahPress} />
        <QuickChip label="Library" icon="rectangle.stack.fill" onPress={onDownloadsPress} />
      </View>

      <SectionHeader title="Recently Added" actionLabel="See All" onAction={onNewestPress} />
      <View style={styles.sectionBody}>
        {recent.map((item) => (
          <ArticleCard
            key={item.id}
            content={item}
            onPress={() => onArticlePress(item)}
            {...cardActions(item)}
          />
        ))}
      </View>

      <SectionHeader title="Topics" />
      <View style={styles.sectionBody}>
        {topics.map((topic) => (
          <TopicButton
            key={topic.id}
            // The live API ships the Parsha CTA as "Read this week"; the app
            // mirrors the website's "Take a look" wording here.
            topic={topic.slug === 'parsha' ? { ...topic, cta: 'Take a look' } : topic}
            onPress={() => onTopicPress(topic)}
          />
        ))}
      </View>

      <SectionHeader title="Authors & Speakers" subtitle="Alphabetical" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.speakerRow}>
        {authors.map((author) => (
          <AuthorButton
            key={author.id}
            author={author}
            onPress={() => onAuthorPress(author)}
            variant="circle"
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © {new Date().getFullYear()} TorahWeb Foundation
        </Text>
      </View>
    </ScrollView>
  );
};

const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, subtitle, actionLabel, onAction }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderText}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
    {actionLabel && onAction ? (
      <Pressable
        onPress={onAction}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}>
        <Text style={styles.sectionAction}>{actionLabel}</Text>
      </Pressable>
    ) : null}
    </View>
  );
};

const QuickChip: React.FC<{ label: string; icon: IconName; onPress: () => void }> = ({
  label,
  icon,
  onPress,
}) => {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <GlassButton
    style={styles.quickChip}
    contentStyle={styles.quickChipInner}
    cornerRadius={radii.md}
    variant="prominent"
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}>
    <Icon name={icon} size={20} color={c.text} />
    <Text
      style={styles.quickChipText}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}>
      {label}
    </Text>
  </GlassButton>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  scrollContent: {
    // paddingTop / paddingBottom set at runtime from useScreenChromeInsets.
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.background,
  },
  titleBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  largeTitle: {
    ...typography.largeTitle,
    color: c.text,
    textAlign: 'center',
  },
  quickRow: {
    // Four chips share the row equally — no wrapping. The icon-over-label
    // layout below keeps each chip narrow enough that "Divrei Torah" can
    // sit on one line on phone screens.
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  quickChip: {
    flex: 1,
    borderRadius: radii.md,
  },
  quickChipInner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    gap: 4,
    borderRadius: radii.md,
  },
  quickChipText: {
    ...typography.caption,
    fontWeight: '600',
    color: c.text,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.title2,
    color: c.text,
  },
  sectionSubtitle: {
    ...typography.footnote,
    color: c.textTertiary,
    marginTop: 2,
  },
  sectionAction: {
    ...typography.subheadline,
    color: c.accent,
    fontWeight: '600',
  },
  sectionBody: {
    paddingHorizontal: spacing.lg,
  },
  speakerRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    ...typography.footnote,
    color: c.textTertiary,
  },
});

export default HomeScreen;
