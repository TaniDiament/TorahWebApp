import React, { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { GlassButton } from './ui/Glass';
import Icon from './ui/Icon';
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
  const {
    currentTrack,
    isPlaying,
    loading,
    progress,
    duration,
    playTrack,
    togglePlayPause,
    seekBy,
    expand,
  } = useAudioPlayer();

  const isCurrent = currentTrack?.id === audioId;
  // Treat a track sitting at the very end as "needs replay" instead of resume,
  // so users don't tap a button that silently no-ops.
  const isAtEnd =
    isCurrent && duration > 0 && progress >= duration - 0.5 && !isPlaying;
  const playLabel = useMemo(() => {
    if (!isCurrent) return 'Play';
    if (isAtEnd) return 'Replay';
    return isPlaying ? 'Pause' : 'Resume';
  }, [isCurrent, isAtEnd, isPlaying]);

  const onPrimaryAction = async () => {
    if (loading) return;
    try {
      if (isAtEnd) {
        await seekBy(-duration);
        await togglePlayPause();
        return;
      }
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
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Please try again.';
      Alert.alert("Couldn't play audio", message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <GlassButton
          style={styles.playButton}
          contentStyle={styles.playButtonInner}
          cornerRadius={radii.pill}
          tint="rgba(26, 58, 92, 0.94)"
          accessibilityRole="button"
          accessibilityLabel={`${playLabel} ${title}`}
          accessibilityState={{ disabled: loading, busy: loading }}
          disabled={loading}
          onPress={onPrimaryAction}>
          {loading ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Icon
              name={isCurrent && isPlaying ? 'pause.fill' : 'play.fill'}
              size={18}
              color={colors.textInverse}
            />
          )}
          <Text style={styles.playText}>{playLabel}</Text>
        </GlassButton>
        {isCurrent ? (
          <Pressable
            onPress={expand}
            accessibilityRole="button"
            accessibilityLabel="Open Now Playing"
            hitSlop={6}
            android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
            style={({ pressed }) => [
              styles.queueButton,
              pressed && { opacity: 0.7 },
            ]}>
            <Text style={styles.queueText}>Now Playing</Text>
            <Icon name="chevron.right" size={14} color={colors.navy} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  playButton: {
    borderRadius: radii.pill,
  },
  playButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    borderRadius: radii.pill,
  },
  playText: {
    ...typography.headline,
    color: colors.textInverse,
    fontWeight: '700',
  },
  queueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  queueText: {
    ...typography.subheadline,
    color: colors.navy,
    fontWeight: '600',
  },
});

export default AudioPlayer;
