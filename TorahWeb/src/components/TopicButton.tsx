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
    accessibilityRole="button"
    accessibilityLabel={`Open topic ${topic.name}`}
    android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
    style={({ pressed }) => [
      styles.card,
      pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
    ]}>
    <View style={styles.thumbWrap}>
      {topic.thumbnailUrl ? (
        <Image source={{ uri: topic.thumbnailUrl }} style={styles.thumb} />
      ) : null}
      <View style={styles.thumbScrim} />
      <View style={styles.thumbContent}>
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
            <Text style={styles.cta} numberOfLines={1}>
              {topic.cta}
            </Text>
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
    // No aspectRatio — height is driven entirely by the text inside, so
    // the coloured band wraps just the eyebrow + title with breathing
    // room. The optional thumbnail becomes a background fill.
    width: '100%',
    backgroundColor: colors.navyDark,
    overflow: 'hidden',
  },
  thumb: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  thumbScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  thumbContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  },
  cta: {
    ...typography.footnote,
    color: colors.navy,
    fontWeight: '700',
    marginRight: 4,
    // Android sometimes adds extra padding around the glyphs which throws off
    // the measure pass for short bold strings inside a flex row, causing the
    // tail of the word to get clipped. Disabling it gives consistent layout.
    includeFontPadding: false,
  },
});

export default TopicButton;
