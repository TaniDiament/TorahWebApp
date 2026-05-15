import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

export type IconName =
  | 'house'
  | 'house.fill'
  | 'magnifyingglass'
  | 'square.stack'
  | 'square.stack.fill'
  | 'arrow.down.circle'
  | 'arrow.down.circle.fill'
  | 'play.fill'
  | 'pause.fill'
  | 'stop.fill'
  | 'forward.15'
  | 'backward.15'
  | 'goforward.30'
  | 'gobackward.15'
  | 'chevron.left'
  | 'chevron.right'
  | 'chevron.down'
  | 'xmark'
  | 'plus'
  | 'ellipsis'
  | 'waveform'
  | 'video.fill'
  | 'doc.text.fill'
  | 'mic.fill'
  | 'sparkles'
  | 'person.crop.circle'
  | 'rectangle.stack.fill'
  | 'square.and.arrow.up'
  | 'wifi.slash'
  | 'torah.scroll';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

const GLYPHS: Record<IconName, string> = {
  house: '⌂',
  'house.fill': '⌂',
  magnifyingglass: '⚲',
  'square.stack': '▢',
  'square.stack.fill': '■',
  'arrow.down.circle': '⤓',
  'arrow.down.circle.fill': '⤓',
  'play.fill': '▶',
  'pause.fill': '⏸',
  'stop.fill': '■',
  'forward.15': '⏩',
  'backward.15': '⏪',
  'goforward.30': '↻',
  'gobackward.15': '↺',
  'chevron.left': '‹',
  'chevron.right': '›',
  'chevron.down': '˅',
  xmark: '×',
  plus: '+',
  ellipsis: '…',
  waveform: '≋',
  'video.fill': '▷',
  'doc.text.fill': '☰',
  'mic.fill': '¶',
  sparkles: '✨',
  'person.crop.circle': '○',
  'rectangle.stack.fill': '▤',
  // square.and.arrow.up and wifi.slash are rendered as shapes — these
  // entries are placeholders so the GLYPHS map stays exhaustive.
  'square.and.arrow.up': '',
  'wifi.slash': '',
  // torah.scroll is rendered as a shape — this entry is just a placeholder
  // so the GLYPHS map stays exhaustive across all IconName values.
  'torah.scroll': '',
};

/**
 * Per-icon glyph rotation. The neuter sign (⚲) used for `magnifyingglass`
 * has its handle pointing straight down; rotating ~-30° tilts the handle
 * toward the lower-right so it reads as a magnifying glass.
 */
const ROTATIONS: Partial<Record<IconName, string>> = {
  magnifyingglass: '-30deg',
};

// Relative heights for the waveform "visualiser" bars, expressed as a
// fraction of the icon size. Mixed heights read as audio more clearly
// than a regular sine pattern.
const WAVEFORM_BAR_HEIGHTS = [0.4, 0.7, 0.55, 0.9, 0.45];

/**
 * Monochrome torah-scroll icon: two vertical handles flanking a panel of
 * three horizontal lines (representing the scroll's text columns).
 */
const TorahScrollShape: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const handleW = size * 0.16;
  const handleH = size * 0.88;
  const paperH = size * 0.66;
  const lineH = Math.max(1.2, size * 0.06);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        gap: size * 0.04,
      }}>
      <View
        style={{
          width: handleW,
          height: handleH,
          backgroundColor: color,
          borderRadius: handleW / 2,
        }}
      />
      <View
        style={{
          height: paperH,
          width: size * 0.42,
          justifyContent: 'space-evenly',
          alignItems: 'center',
        }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: '92%',
              height: lineH,
              backgroundColor: color,
              borderRadius: lineH / 2,
            }}
          />
        ))}
      </View>
      <View
        style={{
          width: handleW,
          height: handleH,
          backgroundColor: color,
          borderRadius: handleW / 2,
        }}
      />
    </View>
  );
};

/**
 * iOS-style share icon: a box opening upward with an arrow rising out of
 * the top. Built from absolutely-positioned primitives so the silhouette
 * is identical across platforms (the SF-Symbols ⇪ unicode fallback renders
 * inconsistently in system fonts). Each layer is centered horizontally
 * via an explicit `left = (size - width) / 2` — alignItems:center won't
 * center absolute children since they're out of flow.
 */
const ShareShape: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const stroke = Math.max(1.5, size * 0.09);
  const headSize = size * 0.34;
  const shaftHeight = size * 0.5;
  const boxH = size * 0.42;
  const boxW = size * 0.78;
  // The ┌ corner with rotate(+45°) places its apex at top-center, slightly
  // above the bounding box (y ≈ -0.207 * headSize). Nudge it down so the
  // apex sits exactly at the wrapper's top edge.
  const headTopOffset = headSize * 0.21;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          top: headTopOffset,
          left: (size - headSize) / 2,
          width: headSize,
          height: headSize,
          borderTopWidth: stroke,
          borderLeftWidth: stroke,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: headSize * 0.5,
          left: (size - stroke) / 2,
          width: stroke,
          height: shaftHeight,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: (size - boxW) / 2,
          width: boxW,
          height: boxH,
          borderWidth: stroke,
          borderTopWidth: 0,
          borderColor: color,
          borderBottomLeftRadius: Math.max(2, size * 0.1),
          borderBottomRightRadius: Math.max(2, size * 0.1),
        }}
      />
    </View>
  );
};

/**
 * Offline indicator: three concentric arcs (rendered as nested rings) with
 * a diagonal slash overlay. Communicates "no network" at glance sizes
 * without depending on emoji fonts.
 */
const WifiSlashShape: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const stroke = Math.max(1.5, size * 0.09);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View
        style={{
          width: size * 0.92,
          height: size * 0.46,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
          position: 'absolute',
          bottom: size * 0.22,
        }}
      />
      <View
        style={{
          width: size * 0.55,
          height: size * 0.28,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
          position: 'absolute',
          bottom: size * 0.22,
        }}
      />
      <View
        style={{
          width: stroke * 1.6,
          height: stroke * 1.6,
          borderRadius: stroke,
          backgroundColor: color,
          position: 'absolute',
          bottom: size * 0.12,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 1.15,
          height: stroke,
          backgroundColor: color,
          top: size * 0.5,
          transform: [{ rotate: '-32deg' }],
        }}
      />
    </View>
  );
};

const WaveformShape: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const barWidth = Math.max(1.5, size * 0.12);
  const gap = Math.max(1, Math.round(size * 0.07));
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: size,
        gap,
      }}>
      {WAVEFORM_BAR_HEIGHTS.map((h, i) => (
        <View
          key={i}
          style={{
            width: barWidth,
            height: Math.max(2, size * h),
            backgroundColor: color,
            borderRadius: barWidth / 2,
          }}
        />
      ))}
    </View>
  );
};

export const Icon: React.FC<IconProps> = ({ name, size = 22, color = '#0a0a0a', style }) => {
  if (name === 'waveform') {
    return (
      <View style={[styles.wrap, { width: size, height: size }, style]}>
        <WaveformShape size={size} color={color} />
      </View>
    );
  }
  if (name === 'torah.scroll') {
    return (
      <View style={[styles.wrap, { width: size, height: size }, style]}>
        <TorahScrollShape size={size} color={color} />
      </View>
    );
  }
  if (name === 'square.and.arrow.up') {
    return (
      <View style={[styles.wrap, { width: size, height: size }, style]}>
        <ShareShape size={size} color={color} />
      </View>
    );
  }
  if (name === 'wifi.slash') {
    return (
      <View style={[styles.wrap, { width: size, height: size }, style]}>
        <WifiSlashShape size={size} color={color} />
      </View>
    );
  }
  const glyph = GLYPHS[name] ?? '○';
  const rotation = ROTATIONS[name];
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size },
        style,
      ]}>
      <Text
        allowFontScaling={false}
        style={[
          styles.glyph,
          {
            fontSize: size,
            lineHeight: size,
            color,
          },
          rotation ? { transform: [{ rotate: rotation }] } : null,
        ]}>
        {glyph}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default Icon;
