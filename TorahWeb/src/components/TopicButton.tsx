import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Topic } from '../types';
import { Palette, radii, shadows, spacing, typography, useTheme, useThemedStyles } from '../theme';
import Icon from './ui/Icon';

interface TopicButtonProps {
  topic: Topic;
  onPress: () => void;
}

const TopicButton: React.FC<TopicButtonProps> = ({ topic, onPress }) => {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open topic ${topic.name}`}
      android_ripple={{ color: c.ripple, borderless: false }}
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
              <Icon name="chevron.right" size={14} color={c.accent} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      width: '100%',
      borderRadius: radii.lg,
      backgroundColor: c.surface,
      overflow: 'hidden',
      marginBottom: spacing.lg,
      ...shadows.card,
    },
    thumbWrap: {
      // No aspectRatio — height is driven entirely by the text inside, so
      // the colored band wraps just the eyebrow + title with breathing
      // room. The optional thumbnail becomes a background fill.
      width: '100%',
      backgroundColor: c.navyDark,
      overflow: 'hidden',
    },
    thumb: {
      ...StyleSheet.absoluteFillObject,
      resizeMode: 'cover',
    },
    thumbScrim: {
      // Darkens the image/band so the white title stays legible — fixed
      // overlay, not theme-dependent.
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.32)',
    },
    thumbContent: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
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
      color: c.textSecondary,
      marginBottom: spacing.sm,
    },
    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cta: {
      ...typography.footnote,
      color: c.accent,
      fontWeight: '700',
      marginRight: 4,
      // Android sometimes adds extra padding around the glyphs which throws off
      // the measure pass for short bold strings inside a flex row, causing the
      // tail of the word to get clipped. Disabling it gives consistent layout.
      includeFontPadding: false,
    },
  });

export default TopicButton;
