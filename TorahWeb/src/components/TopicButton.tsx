import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Topic } from '../types';
import { colors, radii, shadows, spacing, typography } from '../theme';

interface TopicButtonProps {
  topic: Topic;
  onPress: () => void;
}

const TopicButton: React.FC<TopicButtonProps> = ({ topic, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
    <View style={styles.thumbWrap}>
      {topic.thumbnailUrl ? (
        <Image source={{ uri: topic.thumbnailUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.thumbLabel}>
        <Text style={styles.thumbLabelText}>{topic.name.toUpperCase()}</Text>
      </View>
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
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
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
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  thumbLabelText: {
    ...typography.eyebrow,
    color: colors.surface,
  },
  body: {
    padding: spacing.lg,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.navy,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  cta: {
    ...typography.eyebrow,
    color: colors.accent,
  },
});

export default TopicButton;
