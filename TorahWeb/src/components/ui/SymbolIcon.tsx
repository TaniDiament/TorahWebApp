import React from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import Icon, { IconName } from './Icon';

export type SymbolWeight =
  | 'regular'
  | 'medium'
  | 'semibold'
  | 'bold';

// Pull in the native SF Symbol component lazily — `require` lets us swallow the
// load error on Android (where the view isn't registered) without crashing the
// bundle. Same pattern as Glass.tsx's NativeLiquidGlass.
const NativeSFSymbol: React.ComponentType<{
  symbolName?: string;
  pointSize?: number;
  weight?: SymbolWeight;
  tintColor?: string | null;
  style?: StyleProp<ViewStyle>;
}> | null = (() => {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('./TorahWebSFSymbolViewNativeComponent').default;
  } catch {
    return null;
  }
})();

interface SymbolIconProps {
  /**
   * Must be a real SF Symbol name (the `IconName` union already uses
   * SF-Symbol-style names — `play.fill`, `goforward.30`, etc.). On Android the
   * value is mapped to a Material glyph by the `Icon` fallback. Don't use names
   * that have no SF Symbol (e.g. `torah.scroll`) with SymbolIcon.
   */
  name: IconName;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders a native Apple SF Symbol on iOS and falls back to the Material icon
 * font on Android. Used for the audio transport controls so they read as
 * native iOS controls rather than Android glyphs.
 */
const SymbolIcon: React.FC<SymbolIconProps> = ({
  name,
  size = 22,
  color = '#0a0a0a',
  weight = 'regular',
  style,
}) => {
  if (NativeSFSymbol) {
    return (
      <NativeSFSymbol
        symbolName={name}
        pointSize={size}
        weight={weight}
        tintColor={color}
        style={[{ width: size, height: size }, style]}
      />
    );
  }
  return <Icon name={name} size={size} color={color} />;
};

export default SymbolIcon;
