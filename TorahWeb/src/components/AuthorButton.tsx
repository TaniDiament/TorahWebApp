import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Author } from '../types';
import { colors, radii, shadows, spacing, typography } from '../theme';

interface AuthorButtonProps {
  author: Author;
  onPress: () => void;
}

const AuthorButton: React.FC<AuthorButtonProps> = ({ author, onPress }) => (
  <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.imageWrap}>
      {author.portraitUrl ? (
        <Image source={{ uri: author.portraitUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.placeholderText}>
            {author.name
              .split(' ')
              .map((p) => p[0])
              .join('')
              .slice(0, 2)}
          </Text>
        </View>
      )}
      <View style={styles.overlay}>
        <Text style={styles.name} numberOfLines={2}>
          {author.name}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  tile: {
    width: '31%',
    marginBottom: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.card,
  },
  imageWrap: {
    aspectRatio: 1,
    backgroundColor: colors.navyDark,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  name: {
    ...typography.caption,
    color: colors.surface,
    textAlign: 'center',
  },
});

export default AuthorButton;
