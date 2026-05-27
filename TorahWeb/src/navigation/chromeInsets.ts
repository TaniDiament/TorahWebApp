import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Layout constants for the floating chrome rendered by AppNavigator. Kept
// here so scrollable screens can reserve matching padding without each
// duplicating the math.
export const FLOATING_BACK_HEIGHT = 44;
export const FLOATING_BACK_TOP_OFFSET = 8;

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
export const useScreenChromeInsets = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const hasBackOverlay = navigation.canGoBack();

  const topChrome = hasBackOverlay
    ? FLOATING_BACK_TOP_OFFSET + FLOATING_BACK_HEIGHT + CONTENT_GAP
    : CONTENT_GAP;

  return {
    top: insets.top + topChrome,
    bottom: Math.max(insets.bottom, 8) + MINI_PLAYER_CLEARANCE + CONTENT_GAP,
  };
};
