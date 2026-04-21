import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Article, Author, Topic } from '../types';
import { api } from '../services/api';
import AuthorButton from '../components/AuthorButton';
import TopicButton from '../components/TopicButton';
import ArticleCard from '../components/ArticleCard';
import { colors, radii, spacing, typography } from '../theme';

interface HomeScreenProps {
  onAuthorPress: (author: Author) => void;
  onTopicPress: (topic: Topic) => void;
  onArticlePress: (article: Article) => void;
  onSearchPress: () => void;
  onAudioPress: () => void;
  onVideoPress: () => void;
  onNewestPress: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onAuthorPress,
  onTopicPress,
  onArticlePress,
  onSearchPress,
  onAudioPress,
  onVideoPress,
  onNewestPress,
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
          api.getRecent(4),
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
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.hero}>
        <Text style={styles.heroBrand}>TorahWeb</Text>
        <Text style={styles.heroSubtitle}>
          Divrei Torah, videos, and events with special attention to contemporary
          religious and social issues
        </Text>
        <TouchableOpacity style={styles.heroCta} onPress={onSearchPress} activeOpacity={0.85}>
          <Text style={styles.heroCtaText}>SUBSCRIBE. FREE!</Text>
        </TouchableOpacity>
      </View>

      <SectionHeader lead="Most" highlight="Recent" />
      <View style={styles.sectionBody}>
        {recent.map((article) => (
          <ArticleCard
            key={article.id}
            content={article}
            onPress={() => onArticlePress(article)}
          />
        ))}
      </View>

      <SectionHeader lead="Explore Our" highlight="Torah" />
      <View style={styles.sectionBody}>
        {topics.map((topic) => (
          <TopicButton
            key={topic.id}
            topic={topic}
            onPress={() => onTopicPress(topic)}
          />
        ))}
      </View>

      <SectionHeader
        lead="Our"
        highlight="Authors & Speakers"
        subtitle="(alphabetical order)"
      />
      <View style={[styles.sectionBody, styles.authorsGrid]}>
        {authors.map((author) => (
          <AuthorButton
            key={author.id}
            author={author}
            onPress={() => onAuthorPress(author)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © {new Date().getFullYear()} TorahWeb Foundation. All Rights Reserved.
        </Text>
      </View>
      </ScrollView>

      <View style={styles.quickLinksRow}>
        <TouchableOpacity
          style={styles.quickLinkButton}
          onPress={onAudioPress}
          activeOpacity={0.85}>
          <Text style={styles.quickLinkText}>Audio</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLinkButton}
          onPress={onVideoPress}
          activeOpacity={0.85}>
          <Text style={styles.quickLinkText}>Video</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLinkButton}
          onPress={onNewestPress}
          activeOpacity={0.85}>
          <Text style={styles.quickLinkText}>Newest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const SectionHeader: React.FC<{ lead: string; highlight: string; subtitle?: string }> = ({
  lead,
  highlight,
  subtitle,
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionLead}>
      {lead} <Text style={styles.sectionHighlight}>{highlight}</Text>
    </Text>
    {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    <View style={styles.sectionRule} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  hero: {
    backgroundColor: colors.navy,
    paddingVertical: 48,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  heroBrand: {
    ...typography.heroTitle,
    color: colors.surface,
    marginBottom: spacing.md,
  },
  heroSubtitle: {
    color: colors.surface,
    textAlign: 'center',
    opacity: 0.92,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  heroCta: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.sm,
  },
  heroCtaText: {
    ...typography.eyebrow,
    color: colors.navyDark,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  sectionLead: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
  },
  sectionHighlight: {
    color: colors.navy,
  },
  sectionSubtitle: {
    marginTop: spacing.xs,
    ...typography.caption,
    color: colors.textMuted,
  },
  sectionRule: {
    marginTop: spacing.sm,
    height: 2,
    width: 48,
    backgroundColor: colors.accent,
  },
  sectionBody: {
    paddingHorizontal: spacing.lg,
  },
  authorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickLinksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickLinkButton: {
    flex: 1,
    backgroundColor: colors.navy,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  quickLinkText: {
    ...typography.eyebrow,
    color: colors.surface,
  },
  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});

export default HomeScreen;
