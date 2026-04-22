import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Content, isArticle, isAudio, isVideo } from '../types';
import { colors, liquidGlass, radii, shadows, spacing, typography } from '../theme';
import { GlassButton } from './ui/Glass';

interface ArticleCardProps {
  content: Content;
  onPress: () => void;
  compact?: boolean;
}

const eyebrowFor = (c: Content): string => {
  if (isArticle(c)) return c.parshaLabel?.toUpperCase() ?? 'DIVREI TORAH';
  if (isVideo(c)) return 'VIDEO';
  if (isAudio(c)) return 'AUDIO';
  return '';
};

const ArticleCard: React.FC<ArticleCardProps> = ({ content, onPress, compact }) => (
  <GlassButton
    style={[styles.card, compact && styles.cardCompact]}
    contentStyle={[styles.cardInner, compact && styles.cardInnerCompact]}
    onPress={onPress}
  >
    <Text style={styles.eyebrow}>{eyebrowFor(content)}</Text>
    <Text style={styles.title} numberOfLines={3}>
      {content.title}
    </Text>
    <View style={styles.meta}>
      <Text style={styles.author}>{content.author.name}</Text>
    </View>
  </GlassButton>
);

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
  },
  author: {
    ...typography.caption,
    color: liquidGlass.subtleTextOnGlass,
  },
});

export default ArticleCard;
