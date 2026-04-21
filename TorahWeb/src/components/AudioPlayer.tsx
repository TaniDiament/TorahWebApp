import React, { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../theme';

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
    <View style={styles.container}>
      <Text style={styles.eyebrow}>PLAY AUDIO ONLY</Text>
      <Text style={styles.title} numberOfLines={3}>
        {title}
      </Text>
      <TouchableOpacity style={styles.playButton} onPress={open} activeOpacity={0.85}>
        <Text style={styles.playButtonText}>▶   LISTEN</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>Unable to play this audio file.</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
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
    color: colors.navy,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  playButton: {
    backgroundColor: colors.navy,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.pill,
  },
  playButtonText: {
    color: colors.surface,
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
