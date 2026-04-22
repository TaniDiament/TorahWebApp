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
import { BlurView } from '@react-native-community/blur';
import { liquidGlass } from '../../theme';

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface GlassButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

const isiOS = Platform.OS === 'ios';

export const GlassSurface: React.FC<GlassSurfaceProps> = ({ children, style }) => (
  <View style={[styles.base, style]}>
    {isiOS ? (
      <>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType={liquidGlass.blurType}
          blurAmount={liquidGlass.blurAmount}
          reducedTransparencyFallbackColor={liquidGlass.fallbackFill}
        />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay]} />
      </>
    ) : null}
    {children}
  </View>
);

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  style,
  contentStyle,
  ...pressableProps
}) => (
  <Pressable style={style} {...pressableProps}>
    <GlassSurface style={contentStyle}>{children}</GlassSurface>
  </Pressable>
);

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  overlay: {
    backgroundColor: liquidGlass.overlay,
  },
});

