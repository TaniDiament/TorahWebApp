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
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
} from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme';
import { GlassSurface } from '../components/ui/Glass';
import Icon from '../components/ui/Icon';

const TAB_BAR_CLEARANCE = 90;

/**
 * Scalable, font-free play/pause symbol. Avoids unicode ▶/⏸ glyphs that
 * Android's emoji font otherwise renders as a coloured (often orange) box.
 * Sizes are derived from {@code size} (= shape height in px).
 */
const PlayPauseShape: React.FC<{ playing: boolean; size: number; color: string }> = ({
  playing,
  size,
  color,
}) => {
  if (playing) {
    const barWidth = Math.max(2, Math.round(size * 0.235));
    const gap = Math.max(2, Math.round(size * 0.235));
    const total = barWidth * 2 + gap;
    const radius = Math.max(1, Math.round(size * 0.07));
    return (
      <View
        style={{
          width: total,
          height: size,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
        <View
          style={{ width: barWidth, height: size, borderRadius: radius, backgroundColor: color }}
        />
        <View
          style={{ width: barWidth, height: size, borderRadius: radius, backgroundColor: color }}
        />
      </View>
    );
  }
  const halfH = size / 2;
  const w = size * 0.82;
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: halfH,
        borderBottomWidth: halfH,
        borderLeftWidth: w,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
        // A right-pointing triangle's centroid sits 1/3 from the base, so
        // a centered bounding box looks left-heavy. Nudge by ~1/6 of width
        // to put the optical centroid at the parent's centre.
        transform: [{ translateX: Math.round(w * 0.18) }],
      }}
    />
  );
};

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
  const [currentTrack, setCurrentTrack] = useState<AudioTrackPayload | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  // True while a seek is in flight. React Native Track Player emits a
  // transient State.Playing during seekTo even when the player was paused,
  // which would flicker the play/pause icon. We swallow PlaybackState
  // events while this is set.
  const seekingRef = useRef(false);
  const seekClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while the user is actively dragging the progress bar. Suppresses
  // the position-polling effect so the bar doesn't fight the gesture.
  const draggingRef = useRef(false);
  // Latest measured pixel width of the progress-bar hit area; used to
  // convert pan x to a 0..1 ratio. Held in both a ref (for the gesture,
  // which runs outside React render) and state (for thumb positioning,
  // which needs to re-render when layout changes).
  const trackWidthRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);
  // Position the user is dragging *toward*. Committed via seekTo on release.
  const pendingSeekRef = useRef<number | null>(null);
  // When set, overrides `progress` for the bar render so the fill follows
  // the finger immediately even before seekTo() commits.
  const [dragPreview, setDragPreview] = useState<number | null>(null);

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
        case State.Ended:
        case State.Error:
          setIsPlaying(false);
          return;
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

  useEffect(() => {
    if (!currentTrack) {
      setProgress(0);
      setDuration(0);
      return;
    }

    const id = setInterval(async () => {
      // Skip the poll while the user is mid-drag OR a seek is still
      // settling on the native side. Otherwise getPosition() can return
      // a pre-seek value and silently revert the optimistic setProgress(next)
      // we wrote in seekBy() / barGesture.onEnd().
      if (draggingRef.current || seekingRef.current) return;
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
      seekingRef.current = true;
      if (seekClearTimerRef.current) clearTimeout(seekClearTimerRef.current);
      try {
        await TrackPlayer.seekTo(next);
        setProgress(next);
      } finally {
        // Hold the suppression briefly so any transient state events emitted
        // by the native player after seekTo resolves are still ignored.
        seekClearTimerRef.current = setTimeout(() => {
          seekingRef.current = false;
          seekClearTimerRef.current = null;
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
    await TrackPlayer.stop();
    await TrackPlayer.reset();
    setCurrentTrack(null);
    setIsPlaying(false);
    setIsExpanded(false);
    setProgress(0);
    setDuration(0);
  }, []);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidthRef.current = w;
    setTrackWidth(w);
  }, []);

  // The bar reserves space on each side for the thumb so that the thumb's
  // bounding box never overflows the hit area — otherwise a tap on the
  // thumb at ratio=0 / ratio=1 falls outside the gesture handler and the
  // slider feels dead at the ends.
  const THUMB_RADIUS = 8;

  // Pan gesture for the progress bar.
  //
  // `minDistance(0)` makes a quick tap also seek (gesture activates on
  // touch-down). We deliberately do NOT set activeOffsetX/failOffsetY —
  // those would delay activation until a few px of movement, leaving a
  // window where Android's system back-swipe (which fires near the left
  // screen edge) can grab the touch first.
  //
  // Activating on touch-down also means the sheet's pan-down-dismiss
  // gesture can't pull the bar away mid-drag.
  const barGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((e) => {
          draggingRef.current = true;
          const w = trackWidthRef.current;
          const usable = w - 2 * THUMB_RADIUS;
          if (usable > 0 && duration > 0) {
            const ratio = Math.max(0, Math.min(1, (e.x - THUMB_RADIUS) / usable));
            const next = ratio * duration;
            setDragPreview(next);
            pendingSeekRef.current = next;
          }
        })
        .onUpdate((e) => {
          const w = trackWidthRef.current;
          const usable = w - 2 * THUMB_RADIUS;
          if (usable > 0 && duration > 0) {
            const ratio = Math.max(0, Math.min(1, (e.x - THUMB_RADIUS) / usable));
            const next = ratio * duration;
            setDragPreview(next);
            pendingSeekRef.current = next;
          }
        })
        .onEnd(async () => {
          const target = pendingSeekRef.current;
          if (target !== null) {
            seekingRef.current = true;
            if (seekClearTimerRef.current) clearTimeout(seekClearTimerRef.current);
            try {
              await TrackPlayer.seekTo(target);
              setProgress(target);
            } catch {
              /* ignore */
            } finally {
              seekClearTimerRef.current = setTimeout(() => {
                seekingRef.current = false;
                seekClearTimerRef.current = null;
              }, 600);
            }
          }
          pendingSeekRef.current = null;
          setDragPreview(null);
          draggingRef.current = false;
        })
        .onFinalize(() => {
          // Safety net for cancelled gestures (e.g. parent scroll claims it).
          draggingRef.current = false;
        }),
    [duration],
  );

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

  // While dragging, the bar tracks the finger; otherwise it follows the
  // polled playback position.
  const visualProgress = dragPreview !== null ? dragPreview : progress;
  const progressRatio = duration > 0 ? Math.min(1, visualProgress / duration) : 0;
  const sheetProgressRatio =
    duration > 0 ? Math.max(0, Math.min(1, visualProgress / duration)) : 0;

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
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                accessibilityState={{ disabled: loading, busy: loading }}
                android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
                style={({ pressed }) => [
                  styles.miniIconButton,
                  pressed && { opacity: 0.6 },
                ]}>
                <PlayPauseShape playing={isPlaying} size={18} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  close();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close player"
                android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
                style={({ pressed }) => [
                  styles.miniIconButton,
                  pressed && { opacity: 0.6 },
                ]}>
                <Icon name="xmark" size={18} color={colors.text} />
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
                  android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
                  style={({ pressed }) => [
                    styles.sheetCloseButton,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="xmark" size={20} color={colors.text} />
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

              <GestureDetector gesture={barGesture}>
                <View
                  style={styles.sheetProgressHitArea}
                  onLayout={onTrackLayout}
                  accessibilityRole="adjustable"
                  accessibilityLabel="Playback position"
                  accessibilityValue={{
                    min: 0,
                    max: Math.max(1, Math.round(duration)),
                    now: Math.round(visualProgress),
                  }}>
                  <View style={styles.sheetProgressTrack}>
                    <View
                      style={[
                        styles.sheetProgressFill,
                        { width: `${sheetProgressRatio * 100}%` },
                      ]}
                    />
                  </View>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.sheetProgressThumb,
                      {
                        // Travel the thumb across `usable` px (= hit-area
                        // width minus a thumb-radius reserved at each end)
                        // so the bounding box stays inside the touchable
                        // region at both extremes.
                        left:
                          sheetProgressRatio *
                          Math.max(0, trackWidth - 2 * THUMB_RADIUS),
                      },
                      dragPreview !== null && styles.sheetProgressThumbActive,
                    ]}
                  />
                </View>
              </GestureDetector>
              <View style={styles.sheetTimeRow}>
                <Text style={styles.sheetTime}>{formatClock(progress)}</Text>
                <Text style={styles.sheetTime}>-{formatClock(Math.max(0, duration - progress))}</Text>
              </View>

              <View style={styles.controlsRow}>
                <Pressable
                  onPress={() => seekBy(-15)}
                  accessibilityRole="button"
                  accessibilityLabel="Back 15 seconds"
                  android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
                  style={({ pressed }) => [
                    styles.skipButton,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="gobackward.15" size={32} color={colors.text} />
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
                  <PlayPauseShape playing={isPlaying} size={34} color={colors.textInverse} />
                </Pressable>

                <Pressable
                  onPress={() => seekBy(30)}
                  accessibilityRole="button"
                  accessibilityLabel="Forward 30 seconds"
                  android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
                  style={({ pressed }) => [
                    styles.skipButton,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="goforward.30" size={32} color={colors.text} />
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
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: colors.navy,
  },
  gestureRoot: {
    flex: 1,
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
  // Larger hit zone wrapping the visible bar so a tap doesn't have to land
  // on a 6px-tall line. `marginHorizontal` keeps the touchable area
  // clear of Android's left-edge system-back-swipe zone (typically the
  // outermost ~24 px of the screen — at progress=0 our thumb would
  // otherwise sit ~16 px from the screen edge).
  sheetProgressHitArea: {
    height: 28,
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  sheetProgressTrack: {
    height: 6,
    // Inset by the thumb's radius on each side so the visible track
    // matches the thumb's travel range exactly. ratio=0 puts the thumb's
    // centre at the track's left edge; ratio=1 puts it at the right edge.
    marginHorizontal: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
    overflow: 'hidden',
  },
  sheetProgressFill: {
    height: '100%',
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
  },
  sheetProgressThumb: {
    position: 'absolute',
    top: '50%',
    width: 16,
    height: 16,
    borderRadius: 8,
    // No marginLeft: `left` is supplied in pixels so the bounding box
    // always sits inside the hit area's [0, width] range.
    marginTop: -8,
    backgroundColor: colors.navy,
    // Subtle border so the thumb reads against light/dark artwork.
    borderWidth: 2,
    borderColor: '#fff',
  },
  sheetProgressThumbActive: {
    transform: [{ scale: 1.25 }],
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
    // Drop any platform default border/shadow that GlassSurface or Pressable
    // might overlay around the circle so it reads as a single navy disc.
    overflow: 'hidden',
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
