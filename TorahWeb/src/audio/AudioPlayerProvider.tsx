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
  TouchableOpacity,
  View,
} from 'react-native';
import TrackPlayer, { AppKilledPlaybackBehavior, Capability, Event, State } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, liquidGlass, radii, spacing, typography } from '../theme';
import { GlassSurface } from '../components/ui/Glass';

const MINI_PLAYER_BOTTOM_OFFSET = 82;

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
  if (didSetupPlayer) {
    return;
  }

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
        // Ignore polling errors when player is transitioning.
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
    if (!currentTrack) {
      return;
    }

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

  const seekBy = useCallback(async (deltaSeconds: number) => {
    if (!currentTrack) {
      return;
    }

    await ensurePlayer();
    const current = await TrackPlayer.getPosition();
    const max = (await TrackPlayer.getDuration()) || duration;
    const next = Math.max(0, Math.min(max || Number.MAX_SAFE_INTEGER, current + deltaSeconds));
    await TrackPlayer.seekTo(next);
    setProgress(next);
  }, [currentTrack, duration]);

  const expand = useCallback(() => {
    if (!currentTrack) {
      return;
    }
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
            style={[
              styles.miniWrap,
              { bottom: MINI_PLAYER_BOTTOM_OFFSET + Math.max(insets.bottom, spacing.sm) },
            ]}
            onPress={expand}>
            <GlassSurface style={styles.miniPlayer}>
              {currentTrack.artworkUrl ? (
                <Image source={{ uri: currentTrack.artworkUrl }} style={styles.miniArtwork} />
              ) : (
                <View style={[styles.miniArtwork, styles.miniArtworkPlaceholder]} />
              )}
              <View style={styles.miniTextWrap}>
                <Text numberOfLines={1} style={styles.miniTitle}>{currentTrack.title}</Text>
                <Text numberOfLines={1} style={styles.miniArtist}>{currentTrack.artist}</Text>
              </View>
              <TouchableOpacity style={styles.miniAction} onPress={togglePlayPause} disabled={loading}>
                <Text style={styles.miniActionText}>{isPlaying ? '||' : '>'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.miniAction} onPress={close}>
                <Text style={styles.miniActionText}>x</Text>
              </TouchableOpacity>
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
            <GlassSurface style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetHeaderText}>Now Playing</Text>
                <TouchableOpacity onPress={collapse}>
                  <Text style={styles.sheetClose}>Done</Text>
                </TouchableOpacity>
              </View>
              {currentTrack?.artworkUrl ? (
                <Image source={{ uri: currentTrack.artworkUrl }} style={styles.sheetArtwork} />
              ) : (
                <View style={[styles.sheetArtwork, styles.sheetArtworkPlaceholder]} />
              )}
              <Text numberOfLines={2} style={styles.sheetTitle}>{currentTrack?.title}</Text>
              <Text numberOfLines={1} style={styles.sheetArtist}>{currentTrack?.artist}</Text>
              <View style={styles.sheetProgressTrack}>
                <View style={[styles.sheetProgressFill, { width: `${progressRatio * 100}%` }]} />
              </View>
              <View style={styles.sheetTimeRow}>
                <Text style={styles.sheetTime}>{formatClock(progress)}</Text>
                <Text style={styles.sheetTime}>{formatClock(duration)}</Text>
              </View>
              <View style={styles.controlsRow}>
                <TouchableOpacity style={styles.circleButton} onPress={() => seekBy(-15)}>
                  <Text style={styles.circleText}>-15</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.circleButton, styles.playButton]} onPress={togglePlayPause}>
                  <Text style={[styles.circleText, styles.playText]}>{isPlaying ? 'Pause' : 'Play'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.circleButton} onPress={() => seekBy(30)}>
                  <Text style={styles.circleText}>+30</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.closeTrackButton} onPress={close}>
                <Text style={styles.closeTrackText}>Close Player</Text>
              </TouchableOpacity>
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
    left: spacing.md,
    right: spacing.md,
  },
  miniPlayer: {
    ...liquidGlass.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniArtwork: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(26, 58, 92, 0.24)',
  },
  miniArtworkPlaceholder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  miniTextWrap: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  miniTitle: {
    ...typography.caption,
    fontSize: 14,
    color: liquidGlass.textOnGlass,
    fontWeight: '700',
  },
  miniArtist: {
    ...typography.caption,
    color: liquidGlass.subtleTextOnGlass,
  },
  miniAction: {
    ...liquidGlass.button,
    marginLeft: spacing.xs,
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniActionText: {
    ...typography.caption,
    color: liquidGlass.textOnGlass,
    fontWeight: '700',
  },
  miniProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(26, 58, 92, 0.1)',
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6, 16, 28, 0.22)',
  },
  sheet: {
    ...liquidGlass.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: '82%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(15, 36, 59, 0.25)',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sheetHeaderText: {
    ...typography.eyebrow,
    color: liquidGlass.subtleTextOnGlass,
  },
  sheetClose: {
    ...typography.caption,
    color: colors.navy,
    fontWeight: '700',
  },
  sheetArtwork: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(26, 58, 92, 0.2)',
  },
  sheetArtworkPlaceholder: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  sheetTitle: {
    ...typography.sectionTitle,
    color: liquidGlass.textOnGlass,
    marginBottom: spacing.xs,
  },
  sheetArtist: {
    ...typography.body,
    color: liquidGlass.subtleTextOnGlass,
    marginBottom: spacing.lg,
  },
  sheetProgressTrack: {
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(26, 58, 92, 0.14)',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  sheetProgressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  sheetTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sheetTime: {
    ...typography.caption,
    color: liquidGlass.subtleTextOnGlass,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  circleButton: {
    ...liquidGlass.button,
    width: 76,
    height: 76,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    ...liquidGlass.buttonPrimary,
    width: 92,
    height: 92,
  },
  circleText: {
    ...typography.caption,
    color: liquidGlass.textOnGlass,
    fontWeight: '700',
  },
  playText: {
    color: liquidGlass.textOnPrimaryGlass,
  },
  closeTrackButton: {
    alignSelf: 'center',
    ...liquidGlass.buttonDestructive,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  closeTrackText: {
    ...typography.caption,
    color: liquidGlass.destructiveTextOnGlass,
    fontWeight: '700',
  },
});

