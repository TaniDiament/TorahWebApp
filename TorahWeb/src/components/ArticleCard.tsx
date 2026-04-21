import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Content, isArticle, isAudio, isVideo } from '../types';
import { colors, radii, shadows, spacing, typography } from '../theme';

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
  <TouchableOpacity
    style={[styles.card, compact && styles.cardCompact]}
    onPress={onPress}
    activeOpacity={0.85}>
    <Text style={styles.eyebrow}>{eyebrowFor(content)}</Text>
    <Text style={styles.title} numberOfLines={3}>
      {content.title}
    </Text>
    <View style={styles.meta}>
      <Text style={styles.author}>{content.author.name}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.navy,
    ...shadows.card,
  },
  cardCompact: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.cardTitle,
    color: colors.navy,
    marginBottom: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  author: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

export default ArticleCard;
