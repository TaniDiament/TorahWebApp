import { useCallback, useEffect, useRef, useState } from 'react';
import { VolumeManager } from 'react-native-volume-manager';

// Drives the Now Playing volume slider from the *device* output volume (the
// same level the hardware buttons change), Apple-Podcasts style.
//
// `active` should be true while the full player is on screen: it's used to
// suppress the OS volume HUD so dragging our slider doesn't pop the system
// overlay, and the HUD is restored when the player closes.
export const useDeviceVolume = (active: boolean) => {
  const [volume, setVolumeState] = useState(0);
  // Latest value the user dragged to, held briefly so an in-flight change
  // listener echo doesn't yank the thumb back under the finger.
  const settingRef = useRef(false);

  // Seed from the current device volume on mount and keep in sync with external
  // changes (hardware buttons, Control Center). Wrapped defensively so a JS
  // bundle running on a binary that doesn't yet link the native module (before
  // a fresh dev build) degrades to a static slider instead of crashing.
  useEffect(() => {
    let cancelled = false;
    let sub: { remove: () => void } | undefined;
    try {
      VolumeManager.getVolume()
        .then(({ volume: v }) => {
          if (!cancelled) setVolumeState(v);
        })
        .catch(() => {});

      sub = VolumeManager.addVolumeListener(({ volume: v }) => {
        if (settingRef.current) return;
        setVolumeState(v);
      });
    } catch {
      // Native module unavailable — leave volume at its default.
    }
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  // Hide the native volume HUD only while the player is open, then restore it.
  useEffect(() => {
    if (!active) return;
    VolumeManager.showNativeVolumeUI({ enabled: false }).catch(() => {});
    return () => {
      VolumeManager.showNativeVolumeUI({ enabled: true }).catch(() => {});
    };
  }, [active]);

  const setVolume = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(1, next));
    settingRef.current = true;
    setVolumeState(clamped);
    // showUI:false keeps Android's system slider from flashing while we drag.
    VolumeManager.setVolume(clamped, { showUI: false }).catch(() => {});
    // Let the native change event settle before trusting external updates again.
    setTimeout(() => {
      settingRef.current = false;
    }, 250);
  }, []);

  return { volume, setVolume };
};
