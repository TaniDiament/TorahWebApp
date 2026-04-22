import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Author } from '../types';
import { colors, radii, spacing, typography } from '../theme';

interface AuthorButtonProps {
  author: Author;
  onPress: () => void;
  variant?: 'circle' | 'tile';
}

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

const AuthorButton: React.FC<AuthorButtonProps> = ({ author, onPress, variant = 'circle' }) => {
  if (variant === 'circle') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.circleWrap,
          pressed && { opacity: 0.7 },
        ]}>
        <View style={styles.circleImageWrap}>
          {author.portraitUrl ? (
            <Image source={{ uri: author.portraitUrl }} style={styles.circleImage} />
          ) : (
            <View style={[styles.circleImage, styles.placeholder]}>
              <Text style={styles.placeholderText}>{initialsOf(author.name)}</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={2} style={styles.circleName}>
          {author.name}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        pressed && { opacity: 0.85 },
      ]}>
      {author.portraitUrl ? (
        <Image source={{ uri: author.portraitUrl }} style={styles.tileImage} />
      ) : (
        <View style={[styles.tileImage, styles.placeholder]}>
          <Text style={styles.placeholderText}>{initialsOf(author.name)}</Text>
        </View>
      )}
      <Text style={styles.tileName} numberOfLines={2}>
        {author.name}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  circleWrap: {
    width: 96,
    alignItems: 'center',
  },
  circleImageWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: colors.navyDark,
    marginBottom: spacing.sm,
  },
  circleImage: {
    width: '100%',
    height: '100%',
  },
  circleName: {
    ...typography.footnote,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  tile: {
    width: '31%',
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  tileImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.navyDark,
    marginBottom: spacing.xs,
  },
  tileName: {
    ...typography.caption,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 22,
  },
});

export default AuthorButton;
