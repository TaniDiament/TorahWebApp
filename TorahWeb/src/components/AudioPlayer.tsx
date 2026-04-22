import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  const { currentTrack, isPlaying, playTrack, togglePlayPause, expand } = useAudioPlayer();

  const isCurrent = currentTrack?.id === audioId;
  const playLabel = useMemo(() => {
    if (!isCurrent) return 'Play';
    return isPlaying ? 'Pause' : 'Resume';
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
    <View style={styles.container}>
      <View style={styles.row}>
        <GlassButton
          style={styles.playButton}
          contentStyle={styles.playButtonInner}
          cornerRadius={radii.pill}
          tint="rgba(26, 58, 92, 0.94)"
          onPress={onPrimaryAction}>
          <Icon
            name={isCurrent && isPlaying ? 'pause.fill' : 'play.fill'}
            size={18}
            color={colors.textInverse}
          />
          <Text style={styles.playText}>{playLabel}</Text>
        </GlassButton>
        {currentTrack ? (
          <Pressable
            onPress={expand}
            style={({ pressed }) => [
              styles.queueButton,
              pressed && { opacity: 0.7 },
            ]}>
            <Text style={styles.queueText}>Now Playing</Text>
            <Icon name="chevron.right" size={14} color={colors.navy} />
          </Pressable>
        ) : null}
      </View>
      {!currentTrack ? (
        <Text style={styles.hint}>The mini player will stay active while you browse.</Text>
      ) : null}
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
  hint: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});

export default AudioPlayer;
