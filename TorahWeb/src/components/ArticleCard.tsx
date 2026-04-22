import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Content, isArticle, isAudio, isVideo } from '../types';
import { colors, liquidGlass, radii, shadows, spacing, typography } from '../theme';
import { GlassButton } from './ui/Glass';

interface ArticleCardProps {
  content: Content;
  onPress: () => void;
  compact?: boolean;
  onDownloadPress?: () => Promise<void> | void;
}

const eyebrowFor = (c: Content): string => {
  if (isArticle(c)) return c.parshaLabel?.toUpperCase() ?? 'DIVREI TORAH';
  if (isVideo(c)) return 'VIDEO';
  if (isAudio(c)) return 'AUDIO';
  return '';
};

const ArticleCard: React.FC<ArticleCardProps> = ({
  content,
  onPress,
  compact,
  onDownloadPress,
}) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!onDownloadPress || downloading) {
      return;
    }

    setDownloading(true);
    try {
      await onDownloadPress();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <GlassButton
      style={[styles.card, compact && styles.cardCompact]}
      contentStyle={[styles.cardInner, compact && styles.cardInnerCompact]}
      onPress={onPress}>
      <Text style={styles.eyebrow}>{eyebrowFor(content)}</Text>
      <Text style={styles.title} numberOfLines={3}>
        {content.title}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.author}>{content.author.name}</Text>
        {onDownloadPress ? (
          <TouchableOpacity
            style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.85}>
            <Text style={styles.downloadText}>{downloading ? 'DOWNLOADING' : 'DOWNLOAD'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </GlassButton>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  cardInner: {
    ...liquidGlass.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(26, 58, 92, 0.72)',
    ...shadows.card,
  },
  cardCompact: {
    marginBottom: spacing.sm,
  },
  cardInnerCompact: {
    padding: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.cardTitle,
    color: liquidGlass.textOnGlass,
    marginBottom: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  author: {
    ...typography.caption,
    color: liquidGlass.subtleTextOnGlass,
    flex: 1,
    paddingRight: spacing.sm,
  },
  downloadButton: {
    ...liquidGlass.button,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadText: {
    ...typography.caption,
    color: liquidGlass.textOnGlass,
    fontWeight: '700',
  },
});

export default ArticleCard;
