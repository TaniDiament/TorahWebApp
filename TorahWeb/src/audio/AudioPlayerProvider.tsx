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
  Platform,
  Pressable,
  Share,
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
  PitchAlgorithm,
  State,
  useProgress,
} from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette, radii, shadows, spacing, typography, useTheme, useThemedStyles } from '../theme';
import { GlassSurface } from '../components/ui/Glass';
import SymbolIcon from '../components/ui/SymbolIcon';
import { playbackPositions } from './playbackPositions';
import { DEFAULT_PLAYBACK_RATE, PLAYBACK_RATES, playbackRateStore } from './playbackRate';

// Distance from the screen bottom to the mini-player's lower edge — it floats
// just above the system tab bar. The visible gap is this minus the tab bar's
// item-area height: iOS's UITabBar is ~49pt, so ~56 leaves only a slight gap.
// Android's Material bottom nav is taller, so it keeps a larger clearance.
const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 56 : 90;

export interface AudioTrackPayload {
  id: string;
  url: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  // Canonical torahweb.org/content/<kind>/<id> link, used by the Now Playing
  // sheet's share button. Optional so a track can still play if a caller can't
  // build one; the share button is hidden when it's absent.
  shareUrl?: string;
}

interface AudioPlayerContextValue {
  currentTrack: AudioTrackPayload | null;
  isPlaying: boolean;
  isExpanded: boolean;
  progress: number;
  duration: number;
  loading: boolean;
  playbackRate: number;
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

// "1×", "1.25×", "1.5×". The presets are clean decimals, so the default number
// formatting already reads correctly (no trailing zeros to trim).
const formatRate = (rate: number) => `${rate}×`;

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [currentTrack, setCurrentTrack] = useState<AudioTrackPayload | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_PLAYBACK_RATE);
  // Whether the speed picker popover is showing over the Now Playing sheet.
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  // Position/duration come from react-native-track-player's own subscription
  // hook. Polled on the native side at the requested interval; we don't have
  // to maintain a setInterval here.
  //
  // The poll interval is wall-clock, but the displayed clock advances in *media*
  // seconds, which at faster speeds tick by quicker than once per real second.
  // A flat 1 s poll would make the readout skip (0:00 → 0:02 → 0:04 at 2×), so
  // we shrink the interval in proportion to the rate: ~2 samples per displayed
  // second (500 ms / rate) guarantees every whole second shows at any speed.
  // Capped at 120 ms so an extreme rate can't spin the bridge. Changing the
  // interval only restarts polling — useProgress doesn't reset position — so
  // there's no 0:00 flicker when the speed changes.
  const progressInterval = Math.max(120, Math.round(500 / Math.max(playbackRate, 1)));
  const { position: livePosition, duration } = useProgress(progressInterval);
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
  // The chosen rate is read inside playback callbacks (which apply it to the
  // native player) so it must be available without re-creating those callbacks.
  const rateRef = useRef(playbackRate);
  progressRef.current = progress;
  durationRef.current = duration;
  currentTrackRef.current = currentTrack;
  rateRef.current = playbackRate;

  // Restore the listener's last-chosen speed on launch. We only update React
  // state / the ref here — the rate is pushed to the native player on the next
  // play() (see playTrack / togglePlayPause), since there's no track loaded yet.
  useEffect(() => {
    let active = true;
    playbackRateStore.get().then((stored) => {
      if (active) setPlaybackRate(stored);
    });
    return () => {
      active = false;
    };
  }, []);

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
          // Whenever playback actually starts, re-assert the chosen speed.
          // iOS's AVPlayer resets rate to 1.0 on play, and this fires for
          // every resume path — including the lock screen / Control Center /
          // headphone remote that bypass togglePlayPause — so the chosen
          // speed survives all of them. Fire-and-forget; rate is cosmetic
          // relative to keeping playback going.
          TrackPlayer.setRate(rateRef.current).catch(() => {});
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

  // Push the chosen rate to the native player. Called after every play() (not
  // just on user change) because iOS's AVPlayer resets its rate to 1.0 whenever
  // playback (re)starts — without re-applying here, resuming or starting a new
  // track would silently drop back to normal speed. Idempotent and best-effort:
  // a setRate failure must never break play/pause. Stable identity (reads the
  // ref) so the playback callbacks below don't churn.
  const applyRateToPlayer = useCallback(async () => {
    try {
      await TrackPlayer.setRate(rateRef.current);
    } catch {
      // Rate is cosmetic relative to playback — ignore and keep playing.
    }
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
        // These shiurim are speech, so keep pitch corrected at faster speeds —
        // otherwise 1.5×–2× turns the maggid shiur into a chipmunk on iOS.
        pitchAlgorithm: PitchAlgorithm.Voice,
      });
      // Resume where this track was last left off (0 if new / finished). The
      // seek is queued before playback settles; TrackPlayer applies it once the
      // media loads, so the listener starts at their saved spot.
      const resumeAt = await playbackPositions.getPosition(track.id);
      await TrackPlayer.play();
      if (resumeAt > 0) await TrackPlayer.seekTo(resumeAt);
      // Carry the listener's chosen speed onto the freshly-loaded track.
      await applyRateToPlayer();
      setCurrentTrack(track);
      setIsPlaying(true);
      setIsExpanded(false);
    } finally {
      setLoading(false);
    }
  }, [applyRateToPlayer]);

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
    // Restore the chosen speed — iOS resets rate to 1.0 on resume.
    await applyRateToPlayer();
    setIsPlaying(true);
  }, [applyRateToPlayer, currentTrack, saveNow]);

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

  // Select a specific playback speed and remember it (state/ref + disk). We only
  // push the rate to the native player when it's actively playing: setting a
  // non-zero rate on a paused iOS AVPlayer would start playback. When paused we
  // just store the choice and let the next play() apply it via applyRateToPlayer,
  // so changing speed never resumes a paused shiur.
  const applyRate = useCallback(async (rate: number) => {
    rateRef.current = rate;
    setPlaybackRate(rate);
    playbackRateStore.save(rate);
    try {
      if ((await TrackPlayer.getState()) === State.Playing) {
        await TrackPlayer.setRate(rate);
      }
    } catch {
      // No player yet / transient native error — the rate is stored and will
      // be applied on the next play().
    }
  }, []);

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
    setSpeedMenuOpen(false);
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
    setSpeedMenuOpen(false);
    setSeekOverride(null);
  }, [saveNow]);

  // Share the canonical content link for the now-playing track — the same
  // deep-linking torahweb.org/content/<kind>/<id> URL the ContentScreen shares,
  // so a recipient lands back on this shiur. Reads the ref so its identity is
  // stable. No-op (and the button is hidden) when the track carries no link.
  const shareCurrent = useCallback(async () => {
    const track = currentTrackRef.current;
    if (!track?.shareUrl) return;
    const message = `${track.title}\n${track.artist}\n\n${track.shareUrl}`;
    try {
      // `url` is iOS-only; Android reads `message`. Include both so iOS gets a
      // previewable link attachment and Android still ships the URL in-line.
      await Share.share({ title: track.title, message, url: track.shareUrl });
    } catch {
      // User dismissed the sheet or the platform rejected the payload —
      // nothing actionable to surface.
    }
  }, []);

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
      playbackRate,
      playTrack,
      togglePlayPause,
      seekBy,
      expand,
      collapse,
      close,
    }),
    [collapse, close, currentTrack, duration, expand, isExpanded, isPlaying, loading, playbackRate, playTrack, progress, seekBy, togglePlayPause],
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
                  <SymbolIcon name="waveform" size={20} color={c.textInverse} />
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
                <SymbolIcon name={isPlaying ? 'pause.fill' : 'play.fill'} size={18} color={c.text} />
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
                <SymbolIcon name="goforward.30" size={20} color={c.text} />
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
                {currentTrack?.shareUrl ? (
                  <Pressable
                    onPress={shareCurrent}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${currentTrack.title}`}
                    android_ripple={{ color: c.ripple, borderless: true }}
                    style={({ pressed }) => [
                      styles.sheetHeaderButton,
                      pressed && { opacity: 0.6 },
                    ]}>
                    <SymbolIcon name="square.and.arrow.up" size={20} color={c.text} />
                  </Pressable>
                ) : (
                  // Invisible spacer the same size as a header button, so the
                  // eyebrow stays centered between the corners with no link.
                  <View style={styles.sheetHeaderSpacer} />
                )}
                <Text style={styles.sheetEyebrow}>Now Playing</Text>
                <Pressable
                  onPress={close}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close player"
                  android_ripple={{ color: c.ripple, borderless: true }}
                  style={({ pressed }) => [
                    styles.sheetHeaderButton,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <SymbolIcon name="xmark" size={20} color={c.text} />
                </Pressable>
              </View>

              {currentTrack?.artworkUrl ? (
                <Image source={{ uri: currentTrack.artworkUrl }} style={styles.sheetArtwork} />
              ) : (
                <View style={[styles.sheetArtwork, styles.sheetArtworkPlaceholder]}>
                  <SymbolIcon name="waveform" size={64} color={c.textInverse} />
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
                  <SymbolIcon name="gobackward.15" size={32} color={c.text} />
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
                  <SymbolIcon name={isPlaying ? 'pause.fill' : 'play.fill'} size={34} color={c.textInverse} />
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
                  <SymbolIcon name="goforward.30" size={32} color={c.text} />
                </Pressable>
              </View>

              <View style={styles.speedRow}>
                <Pressable
                  onPress={() => setSpeedMenuOpen((open) => !open)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Playback speed ${formatRate(playbackRate)}`}
                  accessibilityHint="Opens a list of playback speeds to choose from"
                  accessibilityState={{ expanded: speedMenuOpen }}
                  android_ripple={{ color: c.ripple, borderless: false }}
                  style={({ pressed }) => [
                    styles.speedChip,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <SymbolIcon name="speedometer" size={16} color={c.text} />
                  <Text style={styles.speedChipText}>{formatRate(playbackRate)}</Text>
                </Pressable>
              </View>

                </GlassSurface>

                {/* Speed picker popover. Rendered in-tree (not a nested Modal /
                    ActionSheetIOS, which present unreliably over an open RN
                    Modal on iOS) and after the sheet so it layers on top. The
                    full-screen backdrop catches an outside tap to dismiss. */}
                {speedMenuOpen ? (
                  <View style={styles.speedMenuLayer} pointerEvents="box-none">
                    <Pressable
                      style={StyleSheet.absoluteFill}
                      onPress={() => setSpeedMenuOpen(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss playback speed menu"
                    />
                    <View
                      style={[
                        styles.speedMenu,
                        { marginBottom: Math.max(insets.bottom, spacing.lg) + 68 },
                      ]}>
                      <View style={styles.speedMenuClip}>
                        {PLAYBACK_RATES.map((rate, i) => {
                          const selected = rate === playbackRate;
                          return (
                            <Pressable
                              key={rate}
                              onPress={() => {
                                applyRate(rate);
                                setSpeedMenuOpen(false);
                              }}
                              accessibilityRole="menuitem"
                              accessibilityState={{ selected }}
                              accessibilityLabel={`${formatRate(rate)}${selected ? ', selected' : ''}`}
                              android_ripple={{ color: c.ripple }}
                              style={({ pressed }) => [
                                styles.speedMenuItem,
                                i > 0 && styles.speedMenuItemDivider,
                                pressed && { backgroundColor: c.surfaceTint },
                              ]}>
                              <Text
                                style={[
                                  styles.speedMenuItemText,
                                  selected && styles.speedMenuItemTextSelected,
                                ]}>
                                {formatRate(rate)}
                              </Text>
                              {selected ? (
                                <SymbolIcon name="checkmark" size={15} color={c.accent} />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                ) : null}
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
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  speedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 72,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: c.surfaceTint,
  },
  speedChipText: {
    ...typography.subheadline,
    color: c.text,
    fontWeight: '700',
    // Keep the chip from reflowing as the digit count changes (1× → 1.25×).
    fontVariant: ['tabular-nums'],
  },
  // Full-screen layer over the sheet that hosts the speed popover. box-none so
  // the dismiss backdrop and the menu receive touches but the layer itself
  // doesn't swallow anything else.
  speedMenuLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // The floating card. Shadow + rounded background live here; corner clipping of
  // the item press highlights is done by speedMenuClip so the shadow isn't
  // masked away on iOS (a view can't both clip its bounds and cast a shadow).
  speedMenu: {
    minWidth: 184,
    borderRadius: radii.md,
    backgroundColor: c.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    ...shadows.floating,
  },
  speedMenuClip: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  speedMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
  },
  speedMenuItemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.separator,
  },
  speedMenuItemText: {
    ...typography.body,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  speedMenuItemTextSelected: {
    color: c.accent,
    fontWeight: '700',
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
  sheetHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderSpacer: {
    width: 36,
    height: 36,
  },
});
