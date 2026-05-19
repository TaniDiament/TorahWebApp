import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Layout constants for the floating chrome rendered by AppNavigator. Kept
// here so scrollable screens can reserve matching padding without each
// duplicating the math.
export const FLOATING_BACK_HEIGHT = 44;
export const FLOATING_BACK_TOP_OFFSET = 8;
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_BOTTOM_OFFSET = 14;

const CONTENT_GAP = 12;

// Returns padding values a scroll container should apply so its content
// clears the floating back overlay (when visible) and the floating tab
// bar. Top reservation is skipped on tab-root screens, where the back
// overlay isn't rendered.
export const useScreenChromeInsets = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const hasBackOverlay = navigation.canGoBack();

  const topChrome = hasBackOverlay
    ? FLOATING_BACK_TOP_OFFSET + FLOATING_BACK_HEIGHT + CONTENT_GAP
    : CONTENT_GAP;

  return {
    top: insets.top + topChrome,
    bottom:
      TAB_BAR_BOTTOM_OFFSET +
      Math.max(insets.bottom, 8) +
      TAB_BAR_HEIGHT +
      CONTENT_GAP,
  };
};
