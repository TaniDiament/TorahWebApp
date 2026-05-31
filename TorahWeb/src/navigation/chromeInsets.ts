import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Layout constants for the floating chrome rendered by AppNavigator. Kept
// here so scrollable screens can reserve matching padding without each
// duplicating the math.
export const FLOATING_BACK_HEIGHT = 44;
// The back overlay is pinned to the very top of the safe area (no extra gap)
// so it sits as high as possible without being clipped by the status bar.
export const FLOATING_BACK_TOP_OFFSET = 0;

const CONTENT_GAP = 12;

// The bottom tab bar is now a native UITabBarController / BottomNavigationView,
// so it owns its own footprint and we no longer reserve its height here. What
// scroll content still has to clear is the floating audio mini-player
// (rendered by AudioPlayerProvider above the tab bar). This reserves room for
// it so the last row isn't hidden when a track is playing. Tune on-device if
// the gap looks too large/small against the system tab bar.
const MINI_PLAYER_CLEARANCE = 76;

// Returns padding values a scroll container should apply so its content
// clears the floating back overlay (when visible) and the floating audio
// mini-player. Top reservation is skipped on tab-root screens, where the
// back overlay isn't rendered.
//
// The app's root <SafeAreaView edges={['top']}> already pads content below the
// status bar, so we must NOT add `insets.top` again here for tab roots — doing
// so double-counts the notch and leaves a visible gap above the large title.
// On a pushed screen the floating back overlay sits a safe-area inset down
// (it lives inside that same SafeAreaView), so its content still has to reserve
// `insets.top` on top of the back-button height to clear it.
export const useScreenChromeInsets = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const hasBackOverlay = navigation.canGoBack();

  const top = hasBackOverlay
    ? insets.top + FLOATING_BACK_TOP_OFFSET + FLOATING_BACK_HEIGHT + CONTENT_GAP
    : CONTENT_GAP;

  return {
    top,
    bottom: Math.max(insets.bottom, 8) + MINI_PLAYER_CLEARANCE + CONTENT_GAP,
  };
};
