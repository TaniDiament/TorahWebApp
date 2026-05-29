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
  AppState,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {
  GestureDetector,
  GestureHandlerRootView,
  Gesture,
} from 'react-native-gesture-handler';
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
  useProgress,
} from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette, radii, spacing, typography, useTheme, useThemedStyles } from '../theme';
import { GlassSurface } from '../components/ui/Glass';
import Icon from '../components/ui/Icon';
import { playbackPositions } from './playbackPositions';

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
  loading: boolean;
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

  await TrackPlayer.setupPlayer({
    // Keep the recently-played minute in memory so a 15 s back-seek doesn't
    // trigger a full re-fetch. Without this, Android ExoPlayer discards
    // played bytes (default backBuffer = 0) and back-seek incurs network
    // round-trip + decoder spin-up. iOS ignores this option.
    backBuffer: 60,
  });
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
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [currentTrack, setCurrentTrack] = useState<AudioTrackPayload | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  // Position/duration come from react-native-track-player's own subscription
  // hook. Polled on the native side at the requested interval; we don't have
  // to maintain a setInterval here.
  const { position: livePosition, duration } = useProgress(1000);
  // Holds a just-issued seek target so the UI shows it instantly instead of
  // waiting for the next useProgress tick to catch up. Cleared after the
  // native player has had a beat to settle (same window as seekingRef).
  const [seekOverride, setSeekOverride] = useState<number | null>(null);
  const progress = seekOverride ?? livePosition;

  // Latest values mirrored into refs so the save callbacks (interval / app
  // background / event listener) read current data without re-subscribing.
  const progressRef = useRef(0);
  const durationRef = useRef(0);
  const currentTrackRef = useRef<AudioTrackPayload | null>(null);
  progressRef.current = progress;
  durationRef.current = duration;
  currentTrackRef.current = currentTrack;

  // Persist the current track's position so it resumes next time. Stable
  // identity (reads refs) so the effects below don't re-run on every tick.
  const saveNow = useCallback(async () => {
    const track = currentTrackRef.current;
    if (!track) return;
    await playbackPositions.save(track.id, progressRef.current, durationRef.current);
  }, []);

  // Checkpoint every few seconds while playing — frequent enough to survive an
  // app kill, rare enough not to hammer the disk on every 1 s progress tick.
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;
    const id = setInterval(() => {
      saveNow();
    }, 5000);
    return () => clearInterval(id);
  }, [isPlaying, currentTrack, saveNow]);

  // The app can be killed from the background without any further JS running,
  // so flush the position the moment we lose foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') saveNow();
    });
    return () => sub.remove();
  }, [saveNow]);

  const translateY = useRef(new Animated.Value(0)).current;
  // True while a seek is in flight. React Native Track Player emits a
  // transient State.Playing during seekTo even when the player was paused,
  // which would flicker the play/pause icon. We swallow PlaybackState
  // events while this is set.
  const seekingRef = useRef(false);
  const seekClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
      if (seekingRef.current) return;
      // Transient states (buffering for the next chunk, ready-but-paused,
      // initial load, none) don't reflect the user's play/pause intent.
      // Only authoritative terminal states move the toggle.
      switch (event.state) {
        case State.Playing:
          setIsPlaying(true);
          return;
        case State.Paused:
        case State.Stopped:
        case State.Error:
          setIsPlaying(false);
          return;
        case State.Ended: {
          // Played to the end — forget the resume point so it replays fresh.
          setIsPlaying(false);
          const track = currentTrackRef.current;
          if (track) playbackPositions.clear(track.id);
          return;
        }
        default:
          // Buffering / Loading / Ready / None → leave the icon alone so
          // the user doesn't see a flash mid-seek or mid-rebuffer.
          return;
      }
    });
    return () => {
      sub.remove();
      if (seekClearTimerRef.current) clearTimeout(seekClearTimerRef.current);
    };
  }, []);

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
      // Resume where this track was last left off (0 if new / finished). The
      // seek is queued before playback settles; TrackPlayer applies it once the
      // media loads, so the listener starts at their saved spot.
      const resumeAt = await playbackPositions.getPosition(track.id);
      await TrackPlayer.play();
      if (resumeAt > 0) await TrackPlayer.seekTo(resumeAt);
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
      saveNow();
      return;
    }
    await TrackPlayer.play();
    setIsPlaying(true);
  }, [currentTrack, saveNow]);

  const seekBy = useCallback(
    async (deltaSeconds: number) => {
      if (!currentTrack) return;
      await ensurePlayer();
      const current = await TrackPlayer.getPosition();
      const max = (await TrackPlayer.getDuration()) || duration;
      const next = Math.max(0, Math.min(max || Number.MAX_SAFE_INTEGER, current + deltaSeconds));
      seekingRef.current = true;
      if (seekClearTimerRef.current) clearTimeout(seekClearTimerRef.current);
      try {
        await TrackPlayer.seekTo(next);
        setSeekOverride(next);
      } finally {
        // Hold the suppression briefly so any transient state events emitted
        // by the native player after seekTo resolves are still ignored, and
        // clear the optimistic override once useProgress should have caught up.
        seekClearTimerRef.current = setTimeout(() => {
          seekingRef.current = false;
          seekClearTimerRef.current = null;
          setSeekOverride(null);
        }, 600);
      }
    },
    [currentTrack, duration],
  );

  const expand = useCallback(() => {
    if (!currentTrack) return;
    // Make sure no stale drag offset carries over from a prior dismissal —
    // the Modal's slide-in animation runs on top of our translateY, so a
    // non-zero starting value would render the sheet partway down.
    translateY.setValue(0);
    setIsExpanded(true);
  }, [currentTrack, translateY]);

  const collapse = useCallback(() => {
    // The Modal's built-in slide-out animation continues *additively* with
    // our translateY, so a sheet released at translateY=120 just keeps
    // sliding off-screen smoothly. The previous implementation snapped
    // translateY back to 0 simultaneously, which made the sheet visually
    // jump up and then slide down — the "happening twice" glitch.
    //
    // We defer the translateY reset until well after the Modal's slide
    // has finished, so the next expand() starts from a clean 0.
    setIsExpanded(false);
    translateY.stopAnimation();
    setTimeout(() => translateY.setValue(0), 320);
  }, [translateY]);

  const close = useCallback(async () => {
    await ensurePlayer();
    // Persist before tearing down so closing the player still resumes later.
    await saveNow();
    await TrackPlayer.stop();
    await TrackPlayer.reset();
    setCurrentTrack(null);
    setIsPlaying(false);
    setIsExpanded(false);
    setSeekOverride(null);
  }, [saveNow]);

  // Commits a slider seek and briefly suppresses the next PlaybackState
  // event so the play/pause icon doesn't flicker through the transient
  // Playing state native side emits during seekTo.
  const commitSeek = useCallback(async (target: number) => {
    seekingRef.current = true;
    if (seekClearTimerRef.current) clearTimeout(seekClearTimerRef.current);
    try {
      await TrackPlayer.seekTo(target);
      setSeekOverride(target);
    } finally {
      seekClearTimerRef.current = setTimeout(() => {
        seekingRef.current = false;
        seekClearTimerRef.current = null;
        setSeekOverride(null);
      }, 600);
    }
  }, []);

  // react-native-gesture-handler's PanGesture, run on the JS thread so it
  // can drive RN's Animated.Value directly. Modal renders in its own
  // Android window outside the root GestureHandlerRootView, so the sheet
  // wraps itself in another GestureHandlerRootView below.
  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        // Only claim the gesture after a clear downward intent — light taps
        // and horizontal swipes still reach inner Pressables.
        .activeOffsetY(10)
        .failOffsetX([-20, 20])
        .onUpdate((e) => {
          if (e.translationY > 0) {
            translateY.setValue(e.translationY);
          }
        })
        .onEnd((e) => {
          if (e.translationY > 110 || e.velocityY > 800) {
            collapse();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
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
      loading,
      playTrack,
      togglePlayPause,
      seekBy,
      expand,
      collapse,
      close,
    }),
    [collapse, close, currentTrack, duration, expand, isExpanded, isPlaying, loading, playTrack, progress, seekBy, togglePlayPause],
  );

  // Mini-player fill bar uses the same `progress` value as the sheet slider;
  // Slider handles its own drag state, so no separate dragPreview is needed.
  const progressRatio = duration > 0 ? Math.min(1, progress / duration) : 0;

  return (
    <AudioPlayerContext.Provider value={value}>
      <View style={styles.root}>
        {children}

        {currentTrack ? (
          <Pressable
            onPress={expand}
            accessibilityRole="button"
            accessibilityLabel={`Open Now Playing: ${currentTrack.title}`}
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
                  <Icon name="waveform" size={20} color={c.textInverse} />
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
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                accessibilityState={{ disabled: loading, busy: loading }}
                android_ripple={{ color: c.ripple, borderless: true }}
                style={({ pressed }) => [
                  styles.miniIconButton,
                  pressed && { opacity: 0.6 },
                ]}>
                <Icon name={isPlaying ? 'pause.fill' : 'play.fill'} size={18} color={c.text} />
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  seekBy(30);
                }}
                disabled={loading}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Skip forward 30 seconds"
                accessibilityState={{ disabled: loading, busy: loading }}
                android_ripple={{ color: c.ripple, borderless: true }}
                style={({ pressed }) => [
                  styles.miniIconButton,
                  pressed && { opacity: 0.6 },
                ]}>
                <Icon name="goforward.30" size={20} color={c.text} />
              </Pressable>
              <View style={styles.miniProgressTrack}>
                <View style={[styles.miniProgressFill, { width: `${progressRatio * 100}%` }]} />
              </View>
            </GlassSurface>
          </Pressable>
        ) : null}

        <Modal visible={isExpanded} animationType="slide" transparent onRequestClose={collapse}>
          <GestureHandlerRootView style={styles.gestureRoot}>
            <GestureDetector gesture={dragGesture}>
              <Animated.View
                style={[styles.sheetOverlay, { transform: [{ translateY }] }]}>
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
                <Pressable
                  onPress={close}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close player"
                  android_ripple={{ color: c.ripple, borderless: true }}
                  style={({ pressed }) => [
                    styles.sheetCloseButton,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="xmark" size={20} color={c.text} />
                </Pressable>
              </View>

              {currentTrack?.artworkUrl ? (
                <Image source={{ uri: currentTrack.artworkUrl }} style={styles.sheetArtwork} />
              ) : (
                <View style={[styles.sheetArtwork, styles.sheetArtworkPlaceholder]}>
                  <Icon name="waveform" size={64} color={c.textInverse} />
                </View>
              )}

              <Text numberOfLines={2} style={styles.sheetTitle}>{currentTrack?.title}</Text>
              <Text numberOfLines={1} style={styles.sheetArtist}>{currentTrack?.artist}</Text>

              <Slider
                style={styles.sheetSlider}
                minimumValue={0}
                maximumValue={Math.max(1, duration)}
                value={progress}
                minimumTrackTintColor={c.accent}
                maximumTrackTintColor={c.separator}
                thumbTintColor={c.accent}
                onSlidingComplete={commitSeek}
                accessibilityLabel="Playback position"
              />
              <View style={styles.sheetTimeRow}>
                <Text style={styles.sheetTime}>{formatClock(progress)}</Text>
                <Text style={styles.sheetTime}>-{formatClock(Math.max(0, duration - progress))}</Text>
              </View>

              <View style={styles.controlsRow}>
                <Pressable
                  onPress={() => seekBy(-15)}
                  accessibilityRole="button"
                  accessibilityLabel="Back 15 seconds"
                  android_ripple={{ color: c.ripple, borderless: true }}
                  style={({ pressed }) => [
                    styles.skipButton,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="gobackward.15" size={32} color={c.text} />
                </Pressable>

                <Pressable
                  onPress={togglePlayPause}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                  accessibilityState={{ disabled: loading, busy: loading }}
                  android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
                  style={({ pressed }) => [
                    styles.playButton,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}>
                  <Icon name={isPlaying ? 'pause.fill' : 'play.fill'} size={34} color={c.textInverse} />
                </Pressable>

                <Pressable
                  onPress={() => seekBy(30)}
                  accessibilityRole="button"
                  accessibilityLabel="Forward 30 seconds"
                  android_ripple={{ color: c.ripple, borderless: true }}
                  style={({ pressed }) => [
                    styles.skipButton,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="goforward.30" size={32} color={c.text} />
                </Pressable>
              </View>

                </GlassSurface>
              </Animated.View>
            </GestureDetector>
          </GestureHandlerRootView>
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
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
    backgroundColor: c.navyDark,
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
    color: c.text,
    fontWeight: '600',
  },
  miniArtist: {
    ...typography.footnote,
    color: c.textTertiary,
    marginTop: 1,
  },
  miniIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: c.hairline,
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: c.accent,
  },
  gestureRoot: {
    flex: 1,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: c.overlay,
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
    backgroundColor: c.separator,
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
    color: c.textSecondary,
  },
  sheetArtwork: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    marginBottom: spacing.xl,
    backgroundColor: c.navyDark,
  },
  sheetArtworkPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    ...typography.title2,
    color: c.text,
    marginBottom: spacing.xs,
  },
  sheetArtist: {
    ...typography.body,
    color: c.textSecondary,
    marginBottom: spacing.xl,
  },
  sheetSlider: {
    width: '100%',
    height: 32,
    // Inset matches the previous hit area, keeping the thumb clear of
    // Android's left-edge back-swipe zone at progress=0.
    marginHorizontal: 0,
  },
  sheetTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: spacing.xl,
  },
  sheetTime: {
    ...typography.footnote,
    color: c.textTertiary,
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
    backgroundColor: c.navy,
    alignItems: 'center',
    justifyContent: 'center',
    // Drop any platform default border/shadow that GlassSurface or Pressable
    // might overlay around the circle so it reads as a single navy disc.
    overflow: 'hidden',
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
