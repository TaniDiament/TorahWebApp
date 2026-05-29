import React from 'react';
import { Platform, useColorScheme } from 'react-native';

const isiOS = Platform.OS === 'ios';

// The set of themeable colors. Two roles to note:
//   navy   — a *fill* (buttons, chips, banners) that always carries white text,
//            so it stays a mid/dark blue in both schemes.
//   accent — *text / tint / spinners* drawn on the page background, so it
//            lightens in dark mode to stay legible.
export interface Palette {
  navy: string;
  navyDark: string;
  navyLight: string;
  accent: string;

  text: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textInverse: string;

  background: string;
  groupedBackground: string;
  surface: string;
  surfaceElevated: string;
  surfaceTint: string;

  separator: string;
  hairline: string;
  border: string;

  destructive: string;
  success: string;

  overlay: string;
  scrim: string;
  /** Android ripple over a page/surface (inverts by scheme so it stays visible). */
  ripple: string;

  androidSurface: string;
  androidSurfaceContainer: string;
  androidSurfaceContainerHigh: string;
  androidPrimaryContainer: string;
  androidOnPrimaryContainer: string;
}

export const lightColors: Palette = {
  navy: '#1a3a5c',
  navyDark: '#122a44',
  navyLight: '#2b5480',
  accent: '#1a3a5c',

  text: '#0a0a0a',
  textPrimary: '#0a0a0a',
  textSecondary: '#3c3c43',
  textTertiary: 'rgba(60, 60, 67, 0.6)',
  textMuted: 'rgba(60, 60, 67, 0.45)',
  textInverse: '#ffffff',

  background: '#f2f2f7',
  groupedBackground: '#f2f2f7',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  surfaceTint: 'rgba(118, 118, 128, 0.08)',

  separator: 'rgba(60, 60, 67, 0.18)',
  hairline: 'rgba(60, 60, 67, 0.12)',
  border: 'rgba(60, 60, 67, 0.12)',

  destructive: '#ff3b30',
  success: '#34c759',

  overlay: 'rgba(0, 0, 0, 0.4)',
  scrim: 'rgba(0, 0, 0, 0.18)',
  ripple: 'rgba(0, 0, 0, 0.06)',

  androidSurface: '#ffffff',
  androidSurfaceContainer: '#eef0f5',
  androidSurfaceContainerHigh: '#e7eaf1',
  androidPrimaryContainer: '#dbe6f3',
  androidOnPrimaryContainer: '#0b2742',
};

// Dark palette — iOS-dark inspired. `textInverse` stays white because it labels
// content on the (still-blue) navy/destructive fills, which don't invert.
export const darkColors: Palette = {
  navy: '#3b6ea5',
  navyDark: '#26537f',
  navyLight: '#5a8fc4',
  accent: '#7fb0e0',

  text: '#f2f2f7',
  textPrimary: '#f2f2f7',
  textSecondary: 'rgba(235, 235, 245, 0.7)',
  textTertiary: 'rgba(235, 235, 245, 0.5)',
  textMuted: 'rgba(235, 235, 245, 0.35)',
  textInverse: '#ffffff',

  background: '#000000',
  groupedBackground: '#000000',
  surface: '#1c1c1e',
  surfaceElevated: '#2c2c2e',
  surfaceTint: 'rgba(118, 118, 128, 0.24)',

  separator: 'rgba(84, 84, 88, 0.6)',
  hairline: 'rgba(84, 84, 88, 0.45)',
  border: 'rgba(84, 84, 88, 0.45)',

  destructive: '#ff453a',
  success: '#30d158',

  overlay: 'rgba(0, 0, 0, 0.6)',
  scrim: 'rgba(0, 0, 0, 0.4)',
  ripple: 'rgba(255, 255, 255, 0.1)',

  androidSurface: '#1c1c1e',
  androidSurfaceContainer: '#1c1c1e',
  androidSurfaceContainerHigh: '#2a2a2c',
  androidPrimaryContainer: '#26415c',
  androidOnPrimaryContainer: '#d6e6f7',
};

// Back-compat: code that imports `colors` directly (e.g. the ErrorBoundary
// fallback, which is a class component and can't use the hook) gets the light
// palette. Prefer `useTheme()` in function components so colors follow the OS.
export const colors = lightColors;

const ThemeContext = React.createContext<Palette>(lightColors);

// Follows the system appearance (Light / Dark / auto) via useColorScheme — no
// in-app toggle or settings screen needed. Wrap the app once near the root.
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? darkColors : lightColors;
  return React.createElement(ThemeContext.Provider, { value: palette }, children);
};

/** The active palette. Re-renders consumers when the system scheme flips. */
export const useTheme = (): Palette => React.useContext(ThemeContext);

/**
 * Build a StyleSheet from the active palette, memoized per scheme. Pass a
 * module-level `makeStyles = (c: Palette) => StyleSheet.create({...})` so its
 * identity is stable and styles are only rebuilt when the scheme changes.
 */
export function useThemedStyles<T>(makeStyles: (c: Palette) => T): T {
  const c = useTheme();
  return React.useMemo(() => makeStyles(c), [c, makeStyles]);
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  largeTitle: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: 0.37,
    lineHeight: 41,
  },
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: 0.36,
    lineHeight: 34,
  },
  title2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: 0.35,
    lineHeight: 28,
  },
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.38,
    lineHeight: 25,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    letterSpacing: -0.41,
    lineHeight: 24,
  },
  callout: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: -0.31,
    lineHeight: 22,
  },
  subheadline: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: -0.24,
    lineHeight: 20,
  },
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: -0.08,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0,
    lineHeight: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    lineHeight: 14,
  },
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 18,
  },
} as const;

export const fonts = {
  display: isiOS ? 'System' : 'sans-serif',
  text: isiOS ? 'System' : 'sans-serif',
} as const;
