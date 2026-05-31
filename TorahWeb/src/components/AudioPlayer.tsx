import React, { useMemo } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';
import { Palette, radii, spacing, typography, useTheme, useThemedStyles } from '../theme';
import { GlassButton } from './ui/Glass';
import SymbolIcon from './ui/SymbolIcon';
import { useAudioPlayer } from '../audio/AudioPlayerProvider';
import type { Audio } from '../types';

interface AudioPlayerProps {
  audioId: string;
  audioUrl: string;
  title: string;
  authorName: string;
  artworkUrl?: string;
  // Canonical content link, forwarded to the Now Playing sheet's share button.
  shareUrl?: string;
  // The originating Audio record, carried into the Now Playing sheet so its
  // download button can save this shiur offline without a re-fetch.
  source?: Audio;
}

// Renders only the primary play / pause / resume control as a pill, sized to
// sit inline beside the Download and Share buttons in ContentScreen's action
// row. The full transport — scrubber, skip, Now Playing — lives in the global
// mini-player and Now Playing sheet from AudioPlayerProvider, which appear once
// a track is loaded, so this screen just needs the start/toggle affordance.
const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioId,
  audioUrl,
  title,
  authorName,
  artworkUrl,
  shareUrl,
  source,
}) => {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    currentTrack,
    isPlaying,
    loading,
    progress,
    duration,
    playTrack,
    togglePlayPause,
    seekBy,
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
        shareUrl,
        source,
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Please try again.';
      Alert.alert("Couldn't play audio", message);
    }
  };

  return (
    <GlassButton
      style={styles.playButton}
      contentStyle={styles.playButtonInner}
      cornerRadius={radii.pill}
      tint={c.navy}
      accessibilityRole="button"
      accessibilityLabel={`${playLabel} ${title}`}
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      onPress={onPrimaryAction}>
      {loading ? (
        <ActivityIndicator color={c.textInverse} size="small" />
      ) : (
        <SymbolIcon
          name={isCurrent && isPlaying ? 'pause.fill' : 'play.fill'}
          size={18}
          color={c.textInverse}
        />
      )}
      <Text style={styles.playText}>{playLabel}</Text>
    </GlassButton>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // Matches downloadButton/downloadButtonInner in ContentScreen so the three
    // controls (Play, Download, Share) read as one 40 px-tall control cluster.
    playButton: {
      borderRadius: radii.pill,
    },
    playButtonInner: {
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      borderRadius: radii.pill,
    },
    playText: {
      ...typography.subheadline,
      color: c.textInverse,
      fontWeight: '700',
    },
  });

export default AudioPlayer;
