import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Content, isArticle, isAudio, isVideo } from '../types';
import VideoPlayer from '../components/VideoPlayer';
import AudioPlayer from '../components/AudioPlayer';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { GlassButton } from '../components/ui/Glass';
import Icon from '../components/ui/Icon';
import { api } from '../services/api';
import { canDownloadContent, downloadContent } from '../services/download';
import type { HomeStackParamList } from '../navigation/types';

// Pick the most "preview-friendly" URL for the share sheet. Vimeo and most
// publisher URLs unfurl into a rich card in Messages / WhatsApp / Mail;
// a bare .mp3 URL doesn't, so we share it anyway but lean on the message
// body to carry the human-readable title + author.
const buildShareTarget = (content: Content) => {
  if (isArticle(content) && content.url) return content.url;
  if (isVideo(content)) {
    if (content.vimeoId) return `https://vimeo.com/${content.vimeoId}`;
    if (content.videoUrl) return content.videoUrl;
  }
  if (isAudio(content)) return content.audioUrl;
  return undefined;
};

// Content screens are registered in every per-tab stack with the same
// route name and the same params shape — typing against the HomeStack's
// "Content" route is sufficient at the call sites because the param shape
// is identical across stacks.
type ContentRoute = RouteProp<HomeStackParamList, 'Content'>;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const ContentScreen: React.FC = () => {
  const route = useRoute<ContentRoute>();
  const params = route.params;
  const [content, setContent] = useState<Content | null>(
    'content' in params ? params.content : null,
  );
  const [downloading, setDownloading] = useState(false);

  // Deep-link entry: only an id + kind are in the URL, so resolve the full
  // record via the provider. In-app pushes carry the hydrated Content and
  // skip this branch entirely.
  useEffect(() => {
    if (content) return;
    if (!('contentId' in params)) return;
    let cancelled = false;
    (async () => {
      const { contentId, contentKind } = params;
      const fetched =
        contentKind === 'article'
          ? await api.getArticle(contentId)
          : contentKind === 'video'
            ? await api.getVideo(contentId)
            : await api.getAudio(contentId);
      if (!cancelled && fetched) setContent(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [content, params]);

  if (!content) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

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

  const onShare = async () => {
    const target = buildShareTarget(content);
    const message = target
      ? `${content.title}\n${content.author.name}\n\n${target}`
      : `${content.title}\n${content.author.name}`;
    try {
      // `url` is iOS-only; on Android the share-sheet reads `message`. We
      // include both so iOS recipients get a previewable link attachment
      // and Android still ships the URL in-line.
      await Share.share({
        title: content.title,
        message,
        ...(target ? { url: target } : {}),
      });
    } catch {
      // User dismissed the sheet or the platform rejected the payload —
      // nothing actionable to surface.
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
        <Text selectable style={styles.title}>{content.title}</Text>
        <Text selectable style={styles.author}>{content.author.name}</Text>
        <Text style={styles.date}>{formatDate(content.publishedDate)}</Text>

        <View style={styles.actionRow}>
          {showDownload ? (
            <GlassButton
              style={styles.downloadButton}
              contentStyle={styles.downloadButtonInner}
              cornerRadius={radii.pill}
              tint="rgba(26, 58, 92, 0.92)"
              disabled={downloading}
              accessibilityRole="button"
              accessibilityLabel={downloading ? 'Downloading' : `Download ${content.title}`}
              accessibilityState={{ disabled: downloading, busy: downloading }}
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
          <GlassButton
            style={styles.shareButton}
            contentStyle={styles.shareButtonInner}
            cornerRadius={radii.pill}
            variant="regular"
            accessibilityRole="button"
            accessibilityLabel={`Share ${content.title}`}
            onPress={onShare}>
            <Icon name="square.and.arrow.up" size={18} color={colors.text} />
          </GlassButton>
        </View>
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
            <Text selectable style={styles.excerpt}>{content.excerpt}</Text>
          ) : null}
          <Text selectable style={styles.body}>{content.content}</Text>
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  // Both buttons render at the same height (40 px) so the row reads as a
  // single control cluster. `alignItems: stretch` on the row + matching
  // contentStyle height keeps the Download pill and Share circle aligned
  // even when the icon/text content differs.
  downloadButton: {
    borderRadius: radii.pill,
  },
  downloadButtonInner: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    borderRadius: radii.pill,
  },
  downloadText: {
    ...typography.subheadline,
    color: colors.textInverse,
    fontWeight: '700',
  },
  shareButton: {
    borderRadius: radii.pill,
  },
  shareButtonInner: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
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
