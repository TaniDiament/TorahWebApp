import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
} from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme';
import { GlassSurface } from '../components/ui/Glass';
import Icon from '../components/ui/Icon';

const TAB_BAR_CLEARANCE = 90;

export interface AudioTrackPayload {
  id: string;
  url: string;
  title: string;
  artist: string;
  artworkUrl?: string;
}

interface AudioPlayerContextValue {
  currentTrack: AudioTrackPayload | null;
  isPlaying: boolean;
  isExpanded: boolean;
  progress: number;
  duration: number;
  playTrack: (track: AudioTrackPayload) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekBy: (deltaSeconds: number) => Promise<void>;
  expand: () => void;
  collapse: () => void;
  close: () => Promise<void>;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);
let didSetupPlayer = false;

const ensurePlayer = async () => {
  if (didSetupPlayer) return;

  await TrackPlayer.setupPlayer();
  await TrackPlayer.updateOptions({
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
    },
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SeekTo,
      Capability.JumpForward,
      Capability.JumpBackward,
    ],
    compactCapabilities: [Capability.Play, Capability.Pause, Capability.JumpBackward, Capability.JumpForward],
    progressUpdateEventInterval: 1,
    forwardJumpInterval: 30,
    backwardJumpInterval: 15,
  });

  didSetupPlayer = true;
};

const formatClock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [currentTrack, setCurrentTrack] = useState<AudioTrackPayload | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
      setIsPlaying(event.state === State.Playing);
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!currentTrack) {
      setProgress(0);
      setDuration(0);
      return;
    }

    const id = setInterval(async () => {
      try {
        const position = await TrackPlayer.getPosition();
        const nextDuration = await TrackPlayer.getDuration();
        setProgress(position || 0);
        setDuration(nextDuration || 0);
      } catch {
        /* ignore */
      }
    }, 1000);

    return () => clearInterval(id);
  }, [currentTrack]);

  const playTrack = useCallback(async (track: AudioTrackPayload) => {
    setLoading(true);
    try {
      await ensurePlayer();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: track.id,
        url: track.url,
        title: track.title,
        artist: track.artist,
        artwork: track.artworkUrl,
      });
      await TrackPlayer.play();
      setCurrentTrack(track);
      setIsPlaying(true);
      setIsExpanded(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (!currentTrack) return;
    await ensurePlayer();
    const state = await TrackPlayer.getState();
    if (state === State.Playing) {
      await TrackPlayer.pause();
      setIsPlaying(false);
      return;
    }
    await TrackPlayer.play();
    setIsPlaying(true);
  }, [currentTrack]);

  const seekBy = useCallback(
    async (deltaSeconds: number) => {
      if (!currentTrack) return;
      await ensurePlayer();
      const current = await TrackPlayer.getPosition();
      const max = (await TrackPlayer.getDuration()) || duration;
      const next = Math.max(0, Math.min(max || Number.MAX_SAFE_INTEGER, current + deltaSeconds));
      await TrackPlayer.seekTo(next);
      setProgress(next);
    },
    [currentTrack, duration],
  );

  const expand = useCallback(() => {
    if (!currentTrack) return;
    setIsExpanded(true);
  }, [currentTrack]);

  const collapse = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 2,
    }).start(() => setIsExpanded(false));
  }, [translateY]);

  const close = useCallback(async () => {
    await ensurePlayer();
    await TrackPlayer.stop();
    await TrackPlayer.reset();
    setCurrentTrack(null);
    setIsPlaying(false);
    setIsExpanded(false);
    setProgress(0);
    setDuration(0);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 110) {
            collapse();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
      }),
    [collapse, translateY],
  );

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      currentTrack,
      isPlaying,
      isExpanded,
      progress,
      duration,
      playTrack,
      togglePlayPause,
      seekBy,
      expand,
      collapse,
      close,
    }),
    [collapse, close, currentTrack, duration, expand, isExpanded, isPlaying, playTrack, progress, seekBy, togglePlayPause],
  );

  const progressRatio = duration > 0 ? Math.min(1, progress / duration) : 0;

  return (
    <AudioPlayerContext.Provider value={value}>
      <View style={styles.root}>
        {children}

        {currentTrack ? (
          <Pressable
            onPress={expand}
            style={[
              styles.miniWrap,
              { bottom: TAB_BAR_CLEARANCE + Math.max(insets.bottom, 8) },
            ]}>
            <GlassSurface
              variant="prominent"
              cornerRadius={radii.lg}
              style={styles.miniPlayer}>
              {currentTrack.artworkUrl ? (
                <Image source={{ uri: currentTrack.artworkUrl }} style={styles.miniArtwork} />
              ) : (
                <View style={[styles.miniArtwork, styles.miniArtworkPlaceholder]}>
                  <Icon name="waveform" size={20} color={colors.textInverse} />
                </View>
              )}
              <View style={styles.miniTextWrap}>
                <Text numberOfLines={1} style={styles.miniTitle}>{currentTrack.title}</Text>
                <Text numberOfLines={1} style={styles.miniArtist}>{currentTrack.artist}</Text>
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                disabled={loading}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.miniIconButton,
                  pressed && { opacity: 0.6 },
                ]}>
                <Icon
                  name={isPlaying ? 'pause.fill' : 'play.fill'}
                  size={22}
                  color={colors.text}
                />
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  close();
                }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.miniIconButton,
                  pressed && { opacity: 0.6 },
                ]}>
                <Icon name="xmark" size={18} color={colors.textTertiary} />
              </Pressable>
              <View style={styles.miniProgressTrack}>
                <View style={[styles.miniProgressFill, { width: `${progressRatio * 100}%` }]} />
              </View>
            </GlassSurface>
          </Pressable>
        ) : null}

        <Modal visible={isExpanded} animationType="slide" transparent onRequestClose={collapse}>
          <Animated.View
            style={[styles.sheetOverlay, { transform: [{ translateY }] }]}
            {...panResponder.panHandlers}>
            <GlassSurface
              variant="prominent"
              cornerRadius={radii.xl}
              style={[
                styles.sheet,
                { paddingBottom: Math.max(insets.bottom, spacing.lg) },
              ]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetEyebrow}>Now Playing</Text>
                <Pressable onPress={collapse} hitSlop={8}>
                  <Icon name="chevron.down" size={22} color={colors.text} />
                </Pressable>
              </View>

              {currentTrack?.artworkUrl ? (
                <Image source={{ uri: currentTrack.artworkUrl }} style={styles.sheetArtwork} />
              ) : (
                <View style={[styles.sheetArtwork, styles.sheetArtworkPlaceholder]}>
                  <Icon name="waveform" size={64} color={colors.textInverse} />
                </View>
              )}

              <Text numberOfLines={2} style={styles.sheetTitle}>{currentTrack?.title}</Text>
              <Text numberOfLines={1} style={styles.sheetArtist}>{currentTrack?.artist}</Text>

              <View style={styles.sheetProgressTrack}>
                <View style={[styles.sheetProgressFill, { width: `${progressRatio * 100}%` }]} />
              </View>
              <View style={styles.sheetTimeRow}>
                <Text style={styles.sheetTime}>{formatClock(progress)}</Text>
                <Text style={styles.sheetTime}>-{formatClock(Math.max(0, duration - progress))}</Text>
              </View>

              <View style={styles.controlsRow}>
                <Pressable
                  onPress={() => seekBy(-15)}
                  style={({ pressed }) => [
                    styles.skipButton,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="gobackward.15" size={32} color={colors.text} />
                </Pressable>

                <Pressable
                  onPress={togglePlayPause}
                  style={({ pressed }) => [
                    styles.playButton,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}>
                  <Icon
                    name={isPlaying ? 'pause.fill' : 'play.fill'}
                    size={42}
                    color={colors.textInverse}
                  />
                </Pressable>

                <Pressable
                  onPress={() => seekBy(30)}
                  style={({ pressed }) => [
                    styles.skipButton,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="goforward.30" size={32} color={colors.text} />
                </Pressable>
              </View>

              <Pressable
                onPress={close}
                style={({ pressed }) => [
                  styles.closeRow,
                  pressed && { opacity: 0.6 },
                ]}>
                <Text style={styles.closeText}>Stop and Close</Text>
              </Pressable>
            </GlassSurface>
          </Animated.View>
        </Modal>
      </View>
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  }
  return ctx;
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  miniWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  miniPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  miniArtwork: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.navyDark,
  },
  miniArtworkPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTextWrap: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  miniTitle: {
    ...typography.subheadline,
    color: colors.text,
    fontWeight: '600',
  },
  miniArtist: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginTop: 1,
  },
  miniIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: colors.navy,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  sheet: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: '88%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(60, 60, 67, 0.28)',
    marginBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  sheetEyebrow: {
    ...typography.eyebrow,
    color: colors.textSecondary,
  },
  sheetArtwork: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.navyDark,
  },
  sheetArtworkPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    ...typography.title2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sheetArtist: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  sheetProgressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
    overflow: 'hidden',
  },
  sheetProgressFill: {
    height: '100%',
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
  },
  sheetTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: spacing.xl,
  },
  sheetTime: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  skipButton: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeRow: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  closeText: {
    ...typography.subheadline,
    color: colors.destructive,
    fontWeight: '600',
  },
});
