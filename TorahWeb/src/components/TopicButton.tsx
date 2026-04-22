import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Topic } from '../types';
import { colors, liquidGlass, radii, shadows, spacing, typography } from '../theme';
import { GlassButton, GlassSurface } from './ui/Glass';

interface TopicButtonProps {
  topic: Topic;
  onPress: () => void;
}

const TopicButton: React.FC<TopicButtonProps> = ({ topic, onPress }) => (
  <GlassButton style={styles.card} contentStyle={styles.cardInner} onPress={onPress}>
    <View style={styles.thumbWrap}>
      {topic.thumbnailUrl ? (
        <Image source={{ uri: topic.thumbnailUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <GlassSurface style={styles.thumbLabel}>
        <Text style={styles.thumbLabelText}>{topic.name.toUpperCase()}</Text>
      </GlassSurface>
    </View>
    <View style={styles.body}>
      <Text style={styles.title}>{topic.name.toUpperCase()}</Text>
      {topic.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {topic.description}
        </Text>
      ) : null}
      {topic.cta ? <Text style={styles.cta}>{topic.cta.toUpperCase()} ...</Text> : null}
    </View>
  </GlassButton>
);

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  cardInner: {
    ...liquidGlass.surface,
    borderRadius: radii.md,
    overflow: 'hidden',
    ...shadows.card,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.navyDark,
  },
  thumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbPlaceholder: {
    backgroundColor: colors.navy,
  },
  thumbLabel: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    ...liquidGlass.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  thumbLabelText: {
    ...typography.eyebrow,
    color: liquidGlass.textOnGlass,
  },
  body: {
    padding: spacing.lg,
  },
  title: {
    ...typography.sectionTitle,
    color: liquidGlass.textOnGlass,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: liquidGlass.subtleTextOnGlass,
    marginBottom: spacing.md,
  },
  cta: {
    ...typography.eyebrow,
    color: colors.accent,
  },
});

export default TopicButton;
