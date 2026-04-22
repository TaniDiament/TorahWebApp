import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { colors, liquidGlass, radii, shadows, spacing, typography } from '../theme';
import { GlassButton, GlassSurface } from './ui/Glass';

interface AudioPlayerProps {
  audioUrl: string;
  title: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, title }) => {
  const [error, setError] = useState(false);

  const open = async () => {
    try {
      const ok = await Linking.canOpenURL(audioUrl);
      if (!ok) {
        setError(true);
        return;
      }
      await Linking.openURL(audioUrl);
    } catch (e) {
      console.error('Audio open failed:', e);
      setError(true);
    }
  };

  return (
    <GlassSurface style={styles.container}>
      <Text style={styles.eyebrow}>PLAY AUDIO ONLY</Text>
      <Text style={styles.title} numberOfLines={3}>
        {title}
      </Text>
      <GlassButton style={styles.playButton} contentStyle={styles.playButtonInner} onPress={open}>
        <Text style={styles.playButtonText}>▶   LISTEN</Text>
      </GlassButton>
      {error ? <Text style={styles.errorText}>Unable to play this audio file.</Text> : null}
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  container: {
    ...liquidGlass.surface,
    padding: spacing.xl,
    borderRadius: radii.md,
    alignItems: 'center',
    ...shadows.card,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    color: liquidGlass.textOnGlass,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  playButton: {
    borderRadius: radii.pill,
  },
  playButtonInner: {
    ...liquidGlass.buttonPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.pill,
  },
  playButtonText: {
    color: liquidGlass.textOnPrimaryGlass,
    fontWeight: '700',
    letterSpacing: 2,
  },
  errorText: {
    marginTop: spacing.md,
    color: '#b00020',
    ...typography.caption,
  },
});

export default AudioPlayer;
