import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Content, isArticle, isAudio, isVideo } from '../types';
import VideoPlayer from '../components/VideoPlayer';
import AudioPlayer from '../components/AudioPlayer';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { GlassButton } from '../components/ui/Glass';
import Icon from '../components/ui/Icon';
import { canDownloadContent, downloadContent } from '../services/download';

interface ContentScreenProps {
  content: Content;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const ContentScreen: React.FC<ContentScreenProps> = ({ content }) => {
  const [downloading, setDownloading] = useState(false);
  const showDownload = canDownloadContent(content);
  const artwork = content.author.portraitUrl;

  const onDownload = async () => {
    if (downloading || !showDownload) return;
    setDownloading(true);
    try {
      await downloadContent(content);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.heroBlock}>
        {artwork ? (
          <Image source={{ uri: artwork }} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]} />
        )}

        <Text style={styles.eyebrow}>
          {isArticle(content) ? (content.parshaLabel ?? 'DIVREI TORAH') : isVideo(content) ? 'VIDEO' : 'AUDIO'}
        </Text>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.author}>{content.author.name}</Text>
        <Text style={styles.date}>{formatDate(content.publishedDate)}</Text>

        {showDownload ? (
          <GlassButton
            style={styles.downloadButton}
            contentStyle={styles.downloadButtonInner}
            cornerRadius={radii.pill}
            tint="rgba(26, 58, 92, 0.92)"
            onPress={onDownload}>
            <Icon
              name="arrow.down.circle.fill"
              size={18}
              color={colors.textInverse}
            />
            <Text style={styles.downloadText}>
              {downloading ? 'Downloading…' : 'Download'}
            </Text>
          </GlassButton>
        ) : null}
      </View>

      {isVideo(content) ? (
        <View style={styles.playerWrap}>
          <VideoPlayer
            vimeoId={content.vimeoId}
            videoUrl={content.videoUrl}
            thumbnailUrl={content.thumbnailUrl}
          />
          {content.description ? (
            <Text style={styles.body}>{content.description}</Text>
          ) : null}
        </View>
      ) : null}

      {isAudio(content) ? (
        <View style={styles.playerWrap}>
          <AudioPlayer
            audioId={content.id}
            audioUrl={content.audioUrl}
            title={content.title}
            authorName={content.author.name}
            artworkUrl={content.author.portraitUrl}
          />
          {content.description ? (
            <Text style={styles.body}>{content.description}</Text>
          ) : null}
        </View>
      ) : null}

      {isArticle(content) ? (
        <View style={styles.articleBody}>
          {content.excerpt ? (
            <Text style={styles.excerpt}>{content.excerpt}</Text>
          ) : null}
          <Text style={styles.body}>{content.content}</Text>
        </View>
      ) : null}

      {content.topics.length > 0 ? (
        <View style={styles.topicsSection}>
          <Text style={styles.topicsHeading}>Topics</Text>
          <View style={styles.topicsRow}>
            {content.topics.map((t) => (
              <View key={t.id} style={styles.topicChip}>
                <Text style={styles.topicChipText}>{t.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  heroBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  artwork: {
    width: '78%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.navyDark,
    marginBottom: spacing.xl,
    ...shadows.elevated,
  },
  artworkPlaceholder: {
    backgroundColor: colors.navy,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  author: {
    ...typography.headline,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  date: {
    ...typography.subheadline,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  downloadButton: {
    borderRadius: radii.pill,
    marginBottom: spacing.lg,
  },
  downloadButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderRadius: radii.pill,
  },
  downloadText: {
    ...typography.subheadline,
    color: colors.textInverse,
    fontWeight: '700',
  },
  playerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  articleBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  excerpt: {
    ...typography.callout,
    fontStyle: 'italic',
    color: colors.textSecondary,
    borderLeftWidth: 3,
    borderLeftColor: colors.navy,
    paddingLeft: spacing.md,
    marginBottom: spacing.lg,
  },
  body: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.md,
  },
  topicsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  topicsHeading: {
    ...typography.title3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  topicChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceTint,
  },
  topicChipText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.text,
  },
});

export default ContentScreen;
