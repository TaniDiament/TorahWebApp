import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Article, Author, Topic } from '../types';
import { api } from '../services/api';
import AuthorButton from '../components/AuthorButton';
import TopicButton from '../components/TopicButton';
import ArticleCard from '../components/ArticleCard';
import { colors, radii, spacing, typography } from '../theme';
import { GlassButton, GlassSurface } from '../components/ui/Glass';
import Icon, { IconName } from '../components/ui/Icon';
import { canDownloadContent, downloadContent } from '../services/download';

interface HomeScreenProps {
  onAuthorPress: (author: Author) => void;
  onTopicPress: (topic: Topic) => void;
  onArticlePress: (article: Article) => void;
  onSearchPress: () => void;
  onAudioPress: () => void;
  onVideoPress: () => void;
  onNewestPress: () => void;
  onDownloadsPress: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onAuthorPress,
  onTopicPress,
  onArticlePress,
  onSearchPress,
  onAudioPress,
  onVideoPress,
  onNewestPress,
  onDownloadsPress,
}) => {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [recent, setRecent] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [a, t, r] = await Promise.all([
          api.getAuthors(),
          api.getTopics(),
          api.getRecent(6),
        ]);
        if (cancelled) return;
        setAuthors(a);
        setTopics(t);
        setRecent(r);
      } catch (err) {
        console.error('HomeScreen load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>TorahWeb</Text>
        <Text style={styles.subtitle}>Divrei Torah, shiurim, and video.</Text>
      </View>

      <View style={styles.quickRow}>
        <QuickChip label="Audio" icon="waveform" onPress={onAudioPress} />
        <QuickChip label="Video" icon="video.fill" onPress={onVideoPress} />
        <QuickChip label="Newest" icon="sparkles" onPress={onNewestPress} />
        <QuickChip label="Library" icon="rectangle.stack.fill" onPress={onDownloadsPress} />
      </View>

      <SectionHeader title="Recently Added" actionLabel="See All" onAction={onNewestPress} />
      <View style={styles.sectionBody}>
        {recent.map((article) => (
          <ArticleCard
            key={article.id}
            content={article}
            onPress={() => onArticlePress(article)}
            onDownloadPress={
              canDownloadContent(article)
                ? async () => {
                    await downloadContent(article);
                  }
                : undefined
            }
          />
        ))}
      </View>

      <SectionHeader title="Topics" />
      <View style={styles.sectionBody}>
        {topics.map((topic) => (
          <TopicButton
            key={topic.id}
            topic={topic}
            onPress={() => onTopicPress(topic)}
          />
        ))}
      </View>

      <SectionHeader title="Speakers" subtitle="Alphabetical" />
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
}> = ({ title, subtitle, actionLabel, onAction }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderText}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
    {actionLabel && onAction ? (
      <Pressable onPress={onAction} hitSlop={8}>
        <Text style={styles.sectionAction}>{actionLabel}</Text>
      </Pressable>
    ) : null}
  </View>
);

const QuickChip: React.FC<{ label: string; icon: IconName; onPress: () => void }> = ({
  label,
  icon,
  onPress,
}) => (
  <GlassButton
    style={styles.quickChip}
    contentStyle={styles.quickChipInner}
    cornerRadius={radii.pill}
    variant="regular"
    onPress={onPress}>
    <Icon name={icon} size={16} color={colors.text} />
    <Text style={styles.quickChipText}>{label}</Text>
  </GlassButton>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingTop: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  titleBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  quickChip: {
    borderRadius: radii.pill,
  },
  quickChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: 6,
    borderRadius: radii.pill,
  },
  quickChipText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.text,
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
    color: colors.text,
  },
  sectionSubtitle: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginTop: 2,
  },
  sectionAction: {
    ...typography.subheadline,
    color: colors.navy,
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
    color: colors.textTertiary,
  },
});

export default HomeScreen;
