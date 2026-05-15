import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme';
import Icon from './ui/Icon';

// A connection counts as "offline" if NetInfo says we're not connected at
// all, OR we're connected to a network the OS has flagged as unreachable
// (captive portal, no DNS, plane Wi-Fi). isInternetReachable being `null`
// means "still measuring" — treat as online to avoid a banner flash on
// app launch.
const isOffline = (state: NetInfoState) => {
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
};

const BANNER_HEIGHT = 30;

const OfflineBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const translateY = useRef(new Animated.Value(-(BANNER_HEIGHT + 40))).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(isOffline(state));
    });
    // NetInfo doesn't always fire on mount — pull the current state once so
    // we display correctly if the app cold-starts offline.
    NetInfo.fetch().then((state) => setOffline(isOffline(state)));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: offline ? 0 : -(BANNER_HEIGHT + insets.top + 8),
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
  }, [offline, translateY, insets.top]);

  return (
    <Animated.View
      pointerEvents={offline ? 'auto' : 'none'}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top,
          transform: [{ translateY }],
        },
      ]}>
      <View style={styles.inner}>
        <Icon name="wifi.slash" size={14} color={colors.textInverse} />
        <Text style={styles.text}>You're offline — downloaded content is still available</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.navy,
    zIndex: 100,
    elevation: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: BANNER_HEIGHT,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radii.sm,
    borderBottomRightRadius: radii.sm,
  },
  text: {
    ...typography.footnote,
    color: colors.textInverse,
    fontWeight: '600',
  },
});

export default OfflineBanner;
