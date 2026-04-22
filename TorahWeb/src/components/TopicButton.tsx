import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Topic } from '../types';
import { colors, radii, shadows, spacing, typography } from '../theme';
import Icon from './ui/Icon';

interface TopicButtonProps {
  topic: Topic;
  onPress: () => void;
}

const TopicButton: React.FC<TopicButtonProps> = ({ topic, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.card,
      pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
    ]}>
    <View style={styles.thumbWrap}>
      {topic.thumbnailUrl ? (
        <Image source={{ uri: topic.thumbnailUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.thumbScrim} />
      <View style={styles.thumbOverlay}>
        <Text style={styles.eyebrow}>TOPIC</Text>
        <Text style={styles.thumbTitle} numberOfLines={2}>{topic.name}</Text>
      </View>
    </View>
    {topic.description ? (
      <View style={styles.body}>
        <Text style={styles.description} numberOfLines={3}>
          {topic.description}
        </Text>
        {topic.cta ? (
          <View style={styles.ctaRow}>
            <Text style={styles.cta}>{topic.cta}</Text>
            <Icon name="chevron.right" size={14} color={colors.navy} />
          </View>
        ) : null}
      </View>
    ) : null}
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: spacing.lg,
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
  thumbScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  thumbOverlay: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },
  thumbTitle: {
    ...typography.title2,
    color: '#fff',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  description: {
    ...typography.subheadline,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cta: {
    ...typography.footnote,
    color: colors.navy,
    fontWeight: '700',
  },
});

export default TopicButton;
