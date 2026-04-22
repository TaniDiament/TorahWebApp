import { Platform } from 'react-native';

const isiOS = Platform.OS === 'ios';

export const colors = {
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

  androidSurface: '#ffffff',
  androidSurfaceContainer: '#eef0f5',
  androidSurfaceContainerHigh: '#e7eaf1',
  androidPrimaryContainer: '#dbe6f3',
  androidOnPrimaryContainer: '#0b2742',
} as const;

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
