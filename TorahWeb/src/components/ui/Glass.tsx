import React from 'react';
import {
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, shadows } from '../../theme';

export type GlassVariant = 'regular' | 'clear' | 'tinted' | 'prominent';

const isiOS = Platform.OS === 'ios';

// Pull in the native component lazily — `require` lets us swallow the load
// error on Android (where the view isn't registered) without crashing the
// JS bundle. On iOS the build links the LiquidGlass pod, so the import
// always succeeds.
const NativeLiquidGlass: React.ComponentType<NativeGlassProps> | null = (() => {
  if (!isiOS) return null;
  try {
    return require('./TorahWebLiquidGlassViewNativeComponent').default;
  } catch {
    return null;
  }
})();

interface NativeGlassProps {
  variant?: GlassVariant;
  glassTintColor?: string;
  cornerRadius?: number;
  isInteractive?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

interface GlassProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: GlassVariant;
  tint?: string;
  cornerRadius?: number;
  interactive?: boolean;
  /** Drop the drop shadow (e.g., for surfaces embedded in scroll content). */
  shadow?: boolean;
}

const flattenStyle = (style: StyleProp<ViewStyle>): ViewStyle =>
  StyleSheet.flatten(style) || {};

const cornerFromStyle = (style: ViewStyle, fallback?: number): number => {
  if (typeof style.borderRadius === 'number') return style.borderRadius;
  if (typeof fallback === 'number') return fallback;
  return radii.lg;
};

const androidFillFor = (variant: GlassVariant, tint?: string) => {
  if (tint) return tint;
  switch (variant) {
    case 'prominent':
      return colors.androidPrimaryContainer;
    case 'tinted':
      return colors.androidSurfaceContainerHigh;
    case 'clear':
      return colors.androidSurface;
    default:
      return colors.androidSurfaceContainer;
  }
};

export const GlassSurface: React.FC<GlassProps> = ({
  children,
  style,
  variant = 'regular',
  tint,
  cornerRadius,
  interactive,
  shadow,
}) => {
  const flat = flattenStyle(style);
  const corner = cornerFromStyle(flat, cornerRadius);
  // Shadows are heavy on stacked surfaces; opt in by default only for the
  // "prominent" variant, where it's part of the visual identity.
  const wantsShadow = shadow ?? variant === 'prominent';

  if (isiOS && NativeLiquidGlass) {
    return (
      <View
        style={[
          style,
          { borderRadius: corner },
          wantsShadow && styles.iosShadow,
          styles.clip,
        ]}>
        <NativeLiquidGlass
          style={StyleSheet.absoluteFillObject}
          variant={variant}
          glassTintColor={tint}
          cornerRadius={corner}
          isInteractive={interactive ?? false}
        />
        {children}
      </View>
    );
  }

  // Android (and the very unlikely iOS-without-native-module path) gets a
  // flat surface tuned to Material's tonal color roles.
  return (
    <View
      style={[
        style,
        {
          borderRadius: corner,
          backgroundColor: androidFillFor(variant, tint),
          borderWidth: variant === 'clear' ? 0 : StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
        },
        variant === 'prominent' ? shadows.elevated : shadows.card,
      ]}>
      {children}
    </View>
  );
};

interface GlassButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  variant?: GlassVariant;
  tint?: string;
  cornerRadius?: number;
  shadow?: boolean;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  style,
  contentStyle,
  variant = 'regular',
  tint,
  cornerRadius,
  shadow,
  ...rest
}) => (
  <Pressable
    {...rest}
    style={({ pressed }) => [style, pressed && styles.pressed]}>
    <GlassSurface
      style={contentStyle}
      variant={variant}
      tint={tint}
      cornerRadius={cornerRadius}
      shadow={shadow}
      interactive>
      {children}
    </GlassSurface>
  </Pressable>
);

const styles = StyleSheet.create({
  iosShadow: {
    shadowColor: '#0b1a2e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
  },
  clip: {
    overflow: 'hidden',
  },
  pressed: {
    opacity: Platform.OS === 'android' ? 0.7 : 0.85,
    transform: [{ scale: 0.98 }],
  },
});
