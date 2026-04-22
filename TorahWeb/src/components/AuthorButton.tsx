import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Author } from '../types';
import { colors, liquidGlass, radii, shadows, spacing, typography } from '../theme';
import { GlassButton, GlassSurface } from './ui/Glass';

interface AuthorButtonProps {
  author: Author;
  onPress: () => void;
}

const AuthorButton: React.FC<AuthorButtonProps> = ({ author, onPress }) => (
  <GlassButton style={styles.tile} contentStyle={styles.tileInner} onPress={onPress}>
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
      <GlassSurface style={styles.overlay}>
        <Text style={styles.name} numberOfLines={2}>
          {author.name}
        </Text>
      </GlassSurface>
    </View>
  </GlassButton>
);

const styles = StyleSheet.create({
  tile: {
    width: '31%',
    marginBottom: spacing.md,
    borderRadius: radii.md,
  },
  tileInner: {
    ...liquidGlass.surface,
    borderRadius: radii.md,
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
    backgroundColor: 'rgba(242, 247, 255, 0.5)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  name: {
    ...typography.caption,
    color: liquidGlass.textOnGlass,
    textAlign: 'center',
  },
});

export default AuthorButton;
