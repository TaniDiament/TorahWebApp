import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Content, isArticle, isAudio, isVideo } from '../types';
import VideoPlayer from '../components/VideoPlayer';
import AudioPlayer from '../components/AudioPlayer';
import { colors, liquidGlass, radii, spacing, typography } from '../theme';
import { GlassSurface } from '../components/ui/Glass';

interface ContentScreenProps {
  content: Content;
}

const ContentScreen: React.FC<ContentScreenProps> = ({ content }) => {
  const showHeroImage = content.author.portraitUrl;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {showHeroImage ? (
        <View style={styles.heroImageWrap}>
          <Image source={{ uri: content.author.portraitUrl }} style={styles.heroImage} />
          <View style={styles.heroImageOverlay} />
        </View>
      ) : (
        <View style={styles.heroFallback} />
      )}

      <GlassSurface style={styles.titleBlock}>
        <Text style={styles.authorLink}>{content.author.name}</Text>
        <Text style={styles.title}>{content.title}</Text>
        {'parshaLabel' in content && content.parshaLabel ? (
          <Text style={styles.parshaTag}>{content.parshaLabel}</Text>
        ) : null}
        <Text style={styles.date}>
          {new Date(content.publishedDate).toLocaleDateString()}
        </Text>
      </GlassSurface>

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
          <AudioPlayer audioUrl={content.audioUrl} title={content.title} />
          {content.description ? (
            <Text style={styles.body}>{content.description}</Text>
          ) : null}
        </View>
      ) : null}

      {isArticle(content) ? (
        <View style={styles.articleBody}>
          {content.excerpt ? <Text style={styles.excerpt}>{content.excerpt}</Text> : null}
          <Text style={styles.body}>{content.content}</Text>
        </View>
      ) : null}

      {content.topics.length > 0 ? (
        <View style={styles.topicsRow}>
          {content.topics.map((t) => (
            <GlassSurface key={t.id} style={styles.topicChip}>
              <Text style={styles.topicChipText}>{t.name}</Text>
            </GlassSurface>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  heroImageWrap: {
    width: '100%',
    height: 200,
    backgroundColor: colors.navyDark,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  heroFallback: {
    width: '100%',
    height: 120,
    backgroundColor: colors.navy,
  },
  titleBlock: {
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.45)',
  },
  authorLink: {
    ...typography.caption,
    color: colors.navy,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    color: liquidGlass.textOnGlass,
    marginBottom: spacing.sm,
  },
  parshaTag: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
  },
  playerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  articleBody: {
    padding: spacing.xl,
  },
  excerpt: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.textSecondary,
    borderLeftWidth: 3,
    borderLeftColor: colors.navy,
    paddingLeft: spacing.md,
    marginBottom: spacing.lg,
  },
  body: {
    ...typography.body,
    color: colors.textPrimary,
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  topicChip: {
    ...liquidGlass.chip,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    marginRight: spacing.sm,
    marginTop: spacing.sm,
  },
  topicChipText: {
    ...typography.caption,
    color: liquidGlass.textOnGlass,
  },
});

export default ContentScreen;
