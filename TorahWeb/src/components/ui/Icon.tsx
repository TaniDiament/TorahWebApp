import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static';

type MCIName = React.ComponentProps<typeof MaterialDesignIcons>['name'];

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
  | 'checkmark'
  | 'xmark'
  | 'plus'
  | 'ellipsis'
  | 'bookmark'
  | 'bookmark.fill'
  | 'waveform'
  | 'speedometer'
  | 'speaker.fill'
  | 'speaker.wave.3.fill'
  | 'video.fill'
  | 'doc.text.fill'
  | 'mic.fill'
  | 'sparkles'
  | 'person.crop.circle'
  | 'rectangle.stack.fill'
  | 'square.and.arrow.up'
  | 'wifi.slash'
  | 'exclamationmark.triangle'
  | 'torah.scroll';

// Map our SF-Symbols-style names onto MaterialDesignIcons glyph names. Keeps
// call sites unchanged while letting MCI handle the actual rendering.
const MCI_MAP: Record<IconName, MCIName> = {
  house: 'home-outline',
  'house.fill': 'home',
  magnifyingglass: 'magnify',
  'square.stack': 'view-stream-outline',
  'square.stack.fill': 'view-stream',
  'arrow.down.circle': 'arrow-down-circle-outline',
  'arrow.down.circle.fill': 'arrow-down-circle',
  'play.fill': 'play',
  'pause.fill': 'pause',
  'stop.fill': 'stop',
  'forward.15': 'fast-forward-15',
  'backward.15': 'rewind-15',
  'goforward.30': 'fast-forward-30',
  'gobackward.15': 'rewind-15',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'chevron.down': 'chevron-down',
  checkmark: 'check',
  xmark: 'close',
  plus: 'plus',
  ellipsis: 'dots-horizontal',
  bookmark: 'bookmark-outline',
  'bookmark.fill': 'bookmark',
  waveform: 'waveform',
  speedometer: 'speedometer',
  'speaker.fill': 'volume-low',
  'speaker.wave.3.fill': 'volume-high',
  'video.fill': 'video',
  'doc.text.fill': 'file-document',
  'mic.fill': 'microphone',
  sparkles: 'star-four-points',
  'person.crop.circle': 'account-circle',
  'rectangle.stack.fill': 'file-multiple',
  'square.and.arrow.up': 'share-variant',
  'wifi.slash': 'wifi-off',
  'exclamationmark.triangle': 'alert-outline',
  'torah.scroll': 'book-open-page-variant',
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export const Icon: React.FC<IconProps> = ({ name, size = 22, color = '#0a0a0a', style }) => (
  <MaterialDesignIcons name={MCI_MAP[name]} size={size} color={color} style={style} />
);

export default Icon;
