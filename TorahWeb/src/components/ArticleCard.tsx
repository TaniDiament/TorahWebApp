import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Content, isArticle, isAudio, isVideo } from '../types';
import { Palette, radii, shadows, spacing, typography, useTheme, useThemedStyles } from '../theme';
import Icon, { IconName } from './ui/Icon';

interface ArticleCardProps {
  content: Content;
  onPress: () => void;
  compact?: boolean;
  // Audio gets a one-tap Download; divrei Torah and video get a Save-to-Library
  // bookmark instead (they aren't downloadable). At most one is provided.
  onDownloadPress?: () => Promise<void> | void;
  onSavePress?: () => void;
  saved?: boolean;
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
  onSavePress,
  saved,
}) => {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
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

  const handleSave = (e?: any) => {
    e?.stopPropagation?.();
    onSavePress?.();
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kindLabel(content)}: ${content.title}, by ${content.author.name}`}
      android_ripple={{ color: c.ripple, borderless: false }}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        pressed && styles.pressed,
      ]}>
      {artwork ? (
        <Image source={{ uri: artwork }} style={styles.artwork} />
      ) : (
        <View style={[styles.artwork, styles.artworkPlaceholder]}>
          <Icon name={kindIcon(content)} size={28} color={c.textInverse} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Icon name={kindIcon(content)} size={11} color={c.textTertiary} />
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
          hitSlop={12}
          disabled={downloading}
          accessibilityRole="button"
          accessibilityLabel={downloading ? 'Downloading' : `Download ${content.title}`}
          accessibilityState={{ disabled: downloading, busy: downloading }}
          android_ripple={{ color: c.ripple, borderless: true }}
          style={({ pressed }) => [
            styles.downloadButton,
            pressed && { opacity: 0.6 },
            downloading && { opacity: 0.5 },
          ]}>
          <Icon name="arrow.down.circle.fill" size={26} color={c.accent} />
        </Pressable>
      ) : onSavePress ? (
        <Pressable
          onPress={handleSave}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={
            saved
              ? `Remove ${content.title} from Library`
              : `Save ${content.title} to Library`
          }
          accessibilityState={{ selected: saved }}
          android_ripple={{ color: c.ripple, borderless: true }}
          style={({ pressed }) => [
            styles.downloadButton,
            pressed && { opacity: 0.6 },
          ]}>
          <Icon
            name={saved ? 'bookmark.fill' : 'bookmark'}
            size={24}
            color={saved ? c.accent : c.textTertiary}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
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
      backgroundColor: c.surfaceTint,
    },
    artworkPlaceholder: {
      backgroundColor: c.navy,
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
      color: c.textTertiary,
      letterSpacing: 0.4,
    },
    dot: {
      color: c.textTertiary,
      marginHorizontal: 2,
    },
    title: {
      ...typography.headline,
      color: c.text,
    },
    author: {
      ...typography.subheadline,
      color: c.textSecondary,
      marginTop: 2,
    },
    downloadButton: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    },
  });

export default ArticleCard;
