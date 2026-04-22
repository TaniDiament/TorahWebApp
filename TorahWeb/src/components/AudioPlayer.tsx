import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, liquidGlass, radii, shadows, spacing, typography } from '../theme';
import { GlassButton, GlassSurface } from './ui/Glass';
import { useAudioPlayer } from '../audio/AudioPlayerProvider';

interface AudioPlayerProps {
  audioId: string;
  audioUrl: string;
  title: string;
  authorName: string;
  artworkUrl?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioId,
  audioUrl,
  title,
  authorName,
  artworkUrl,
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, expand } = useAudioPlayer();

  const isCurrent = currentTrack?.id === audioId;

  const actionLabel = useMemo(() => {
    if (!isCurrent) {
      return 'PLAY';
    }
    return isPlaying ? 'PAUSE' : 'RESUME';
  }, [isCurrent, isPlaying]);

  const onPrimaryAction = async () => {
    if (isCurrent) {
      await togglePlayPause();
      return;
    }

    await playTrack({
      id: audioId,
      url: audioUrl,
      title,
      artist: authorName,
      artworkUrl,
    });
  };

  return (
    <GlassSurface style={styles.container}>
      <Text style={styles.eyebrow}>PLAY AUDIO ONLY</Text>
      <Text style={styles.title} numberOfLines={3}>
        {title}
      </Text>
      <View style={styles.controlsRow}>
        <GlassButton
          style={styles.playButton}
          contentStyle={styles.playButtonInner}
          onPress={onPrimaryAction}>
          <Text style={styles.playButtonText}>{actionLabel}</Text>
        </GlassButton>
        <GlassButton
          style={styles.queueButton}
          contentStyle={styles.queueButtonInner}
          onPress={expand}
          disabled={!currentTrack}>
          <Text style={styles.queueButtonText}>NOW PLAYING</Text>
        </GlassButton>
      </View>
      {!currentTrack ? (
        <Text style={styles.hintText}>The mini player will stay active while you navigate.</Text>
      ) : null}
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
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
  },
  playButtonText: {
    color: liquidGlass.textOnPrimaryGlass,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  queueButton: {
    borderRadius: radii.pill,
  },
  queueButtonInner: {
    ...liquidGlass.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  queueButtonText: {
    ...typography.caption,
    color: liquidGlass.textOnGlass,
    fontWeight: '700',
  },
  hintText: {
    marginTop: spacing.md,
    ...typography.caption,
    color: liquidGlass.subtleTextOnGlass,
    textAlign: 'center',
  },
});

export default AudioPlayer;
