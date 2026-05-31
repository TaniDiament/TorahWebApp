import React from 'react';
import { StyleSheet, View } from 'react-native';

interface CircularProgressProps {
  /** Outer diameter of the ring, in px. */
  size: number;
  /** Ring thickness, in px. */
  strokeWidth: number;
  /** Fractional progress, 0..1 (clamped). */
  progress: number;
  /** Filled-arc color. */
  color: string;
  /** Unfilled-track color. */
  trackColor: string;
  /**
   * Color of the punched-out center — set this to the surface the ring sits on
   * so the middle reads as a hole rather than a disc.
   */
  innerColor: string;
  /** Optional content centered inside the ring (e.g. a stop square). */
  children?: React.ReactNode;
}

// A determinate circular progress ring built entirely from <View>s — no
// react-native-svg dependency (which would force a native rebuild). It fills
// clockwise from the top, Apple-Podcasts style.
//
// Technique (the well-worn "two rotating half-discs" trick): a full track disc
// underneath, then two colored half-discs each clipped to one side of the
// circle. The right half sweeps 0–180° (first 50%) and the left half sweeps
// 180–360° (last 50%). The translateX→rotate→translateX sequence shifts each
// half's rotation pivot from its own center onto the circle's center. A final
// inner disc the color of the backdrop punches the hole that turns the disc
// into a ring.
const CircularProgress: React.FC<CircularProgressProps> = ({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
  innerColor,
  children,
}) => {
  const radius = size / 2;
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * 100;

  let rightDeg = '0deg';
  let leftDeg = '0deg';
  if (pct >= 50) {
    rightDeg = '180deg';
    leftDeg = `${(pct - 50) * 3.6}deg`;
  } else {
    rightDeg = `${pct * 3.6}deg`;
  }

  const innerSize = Math.max(0, (radius - strokeWidth) * 2);

  return (
    <View
      style={[
        styles.outer,
        { width: size, height: size, borderRadius: radius, backgroundColor: trackColor },
      ]}>
      {/* Right semicircle clip — fills 0–180° (left: 0 comes from styles.half) */}
      <View style={[styles.half, { width: radius, height: size }]}>
        <View
          style={[
            styles.fill,
            {
              left: radius,
              width: radius,
              height: size,
              borderTopRightRadius: radius,
              borderBottomRightRadius: radius,
              backgroundColor: color,
              transform: [
                { translateX: -radius / 2 },
                { rotate: rightDeg },
                { translateX: radius / 2 },
              ],
            },
          ]}
        />
      </View>

      {/* Left semicircle clip — fills 180–360° */}
      <View style={[styles.half, { width: radius, height: size, left: radius }]}>
        <View
          style={[
            styles.fill,
            {
              left: -radius,
              width: radius,
              height: size,
              borderTopLeftRadius: radius,
              borderBottomLeftRadius: radius,
              backgroundColor: color,
              transform: [
                { translateX: radius / 2 },
                { rotate: leftDeg },
                { translateX: -radius / 2 },
              ],
            },
          ]}
        />
      </View>

      {/* Center hole turns the disc into a ring (and hosts optional children). */}
      <View
        style={[
          styles.inner,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: innerColor,
          },
        ]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  half: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
  },
  // Not absolutely positioned: it's the sole in-flow child, so the outer's
  // center alignment centers the hole. (The half wrappers are absolute and
  // don't take part in that layout.)
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CircularProgress;
