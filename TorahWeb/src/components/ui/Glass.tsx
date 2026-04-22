import React from 'react';
import {
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
  requireNativeComponent,
  UIManager,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { colors, radii, shadows } from '../../theme';

export type GlassVariant = 'regular' | 'clear' | 'tinted' | 'prominent';

interface NativeGlassProps extends ViewProps {
  variant?: GlassVariant;
  glassTintColor?: string;
  cornerRadius?: number;
  isInteractive?: boolean;
}

const isiOS = Platform.OS === 'ios';

const HAS_NATIVE_GLASS = (() => {
  if (!isiOS) return false;
  try {
    return UIManager?.getViewManagerConfig?.('TorahWebLiquidGlassView') != null;
  } catch {
    return false;
  }
})();

const NativeLiquidGlass: React.ComponentType<NativeGlassProps> | null = HAS_NATIVE_GLASS
  ? requireNativeComponent<NativeGlassProps>('TorahWebLiquidGlassView')
  : null;

interface GlassProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: GlassVariant;
  tint?: string;
  cornerRadius?: number;
  interactive?: boolean;
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
}) => {
  const flat = flattenStyle(style);
  const corner = cornerFromStyle(flat, cornerRadius);

  if (NativeLiquidGlass) {
    return (
      <View style={[style, { borderRadius: corner }, styles.iosShadow, styles.clip]}>
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

  if (isiOS) {
    return (
      <View style={[style, { borderRadius: corner }, styles.iosShadow, styles.clip]}>
        <BlurView
          style={[StyleSheet.absoluteFillObject]}
          blurType={variant === 'prominent' ? 'materialLight' : 'ultraThinMaterialLight'}
          blurAmount={variant === 'clear' ? 18 : 28}
          reducedTransparencyFallbackColor="#f5f6fa"
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: tint ?? 'rgba(255,255,255,0.18)',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.6)',
              borderRadius: corner,
            },
          ]}
        />
        {children}
      </View>
    );
  }

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
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  style,
  contentStyle,
  variant = 'regular',
  tint,
  cornerRadius,
  ...rest
}) => (
  <Pressable
    {...rest}
    style={({ pressed }) => [
      style,
      pressed && styles.pressed,
    ]}>
    <GlassSurface
      style={contentStyle}
      variant={variant}
      tint={tint}
      cornerRadius={cornerRadius}
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
