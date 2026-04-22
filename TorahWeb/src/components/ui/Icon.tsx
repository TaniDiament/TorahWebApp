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
  | 'rectangle.stack.fill';

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
};

export const Icon: React.FC<IconProps> = ({ name, size = 22, color = '#0a0a0a', style }) => {
  const glyph = GLYPHS[name] ?? '○';
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
