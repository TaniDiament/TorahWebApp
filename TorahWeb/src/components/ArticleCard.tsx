import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Content, isArticle, isAudio, isVideo } from '../types';
import { colors, radii, shadows, spacing, typography } from '../theme';
import Icon, { IconName } from './ui/Icon';

interface ArticleCardProps {
  content: Content;
  onPress: () => void;
  compact?: boolean;
  onDownloadPress?: () => Promise<void> | void;
}

const kindLabel = (c: Content): string => {
  if (isArticle(c)) return c.parshaLabel ?? 'Divrei Torah';
  if (isVideo(c)) return 'Video';
  if (isAudio(c)) return 'Audio';
  return '';
};

const kindIcon = (c: Content): IconName => {
  if (isVideo(c)) return 'video.fill';
  if (isAudio(c)) return 'waveform';
  return 'doc.text.fill';
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const ArticleCard: React.FC<ArticleCardProps> = ({
  content,
  onPress,
  compact,
  onDownloadPress,
}) => {
  const [downloading, setDownloading] = useState(false);
  const artwork = content.author.portraitUrl;

  const handleDownload = async (e?: any) => {
    e?.stopPropagation?.();
    if (!onDownloadPress || downloading) return;
    setDownloading(true);
    try {
      await onDownloadPress();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        pressed && styles.pressed,
      ]}>
      {artwork ? (
        <Image source={{ uri: artwork }} style={styles.artwork} />
      ) : (
        <View style={[styles.artwork, styles.artworkPlaceholder]}>
          <Icon name={kindIcon(content)} size={28} color={colors.textInverse} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Icon name={kindIcon(content)} size={11} color={colors.textTertiary} />
          <Text style={styles.eyebrow}>{kindLabel(content).toUpperCase()}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.eyebrow}>{formatDate(content.publishedDate)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {content.title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {content.author.name}
        </Text>
      </View>
      {onDownloadPress ? (
        <Pressable
          onPress={handleDownload}
          hitSlop={8}
          style={({ pressed }) => [
            styles.downloadButton,
            pressed && { opacity: 0.6 },
            downloading && { opacity: 0.5 },
          ]}>
          <Icon name="arrow.down.circle.fill" size={26} color={colors.navy} />
        </Pressable>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardCompact: {
    padding: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  artwork: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceTint,
  },
  artworkPlaceholder: {
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  eyebrow: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.4,
  },
  dot: {
    color: colors.textTertiary,
    marginHorizontal: 2,
  },
  title: {
    ...typography.headline,
    color: colors.text,
  },
  author: {
    ...typography.subheadline,
    color: colors.textSecondary,
    marginTop: 2,
  },
  downloadButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
});

export default ArticleCard;
