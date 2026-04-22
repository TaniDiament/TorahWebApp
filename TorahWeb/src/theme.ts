import { Platform } from 'react-native';

export const colors = {
  navy: '#1a3a5c',
  navyDark: '#122a44',
  navyLight: '#2b5480',
  accent: '#c49a3f',
  textPrimary: '#222222',
  textSecondary: '#555555',
  textMuted: '#888888',
  background: '#f5f5f5',
  surface: '#ffffff',
  border: '#e0e0e0',
  overlay: 'rgba(26, 58, 92, 0.82)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const typography = {
  heroTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.3 },
  sectionTitle: { fontSize: 22, fontWeight: '700' as const },
  cardTitle: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 26, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  eyebrow: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 1.2 },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
} as const;

const isiOS = Platform.OS === 'ios';

export const liquidGlass = {
  blurType: (isiOS ? 'ultraThinMaterialLight' : 'light') as 'ultraThinMaterialLight' | 'light',
  blurAmount: isiOS ? 26 : 0,
  overlay: isiOS ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
  fallbackFill: '#f2f6fc',
  header: isiOS
    ? {
        backgroundColor: 'rgba(248, 251, 255, 0.74)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.5)',
        shadowColor: '#0b1d2f',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      }
    : {
        backgroundColor: colors.navy,
      },
  surface: isiOS
    ? {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.45)',
        shadowColor: '#0b1d2f',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
      }
    : {
        backgroundColor: colors.surface,
      },
  button: isiOS
    ? {
        backgroundColor: 'rgba(255, 255, 255, 0.26)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.52)',
        shadowColor: '#0b1d2f',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      }
    : {
        backgroundColor: colors.navy,
      },
  buttonPrimary: isiOS
    ? {
        backgroundColor: 'rgba(29, 74, 117, 0.8)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        shadowColor: '#0b1d2f',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      }
    : {
        backgroundColor: colors.navy,
      },
  buttonDestructive: isiOS
    ? {
        backgroundColor: 'rgba(176, 0, 32, 0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255, 108, 130, 0.35)',
        shadowColor: '#5e0014',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      }
    : {
        backgroundColor: '#b00020',
      },
  chip: isiOS
    ? {
        backgroundColor: 'rgba(255, 255, 255, 0.34)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.42)',
      }
    : {
        backgroundColor: colors.navy,
      },
  input: isiOS
    ? {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.62)',
        shadowColor: '#0b1d2f',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      }
    : {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.navy,
      },
  textOnGlass: isiOS ? '#0f243b' : colors.surface,
  textOnPrimaryGlass: colors.surface,
  subtleTextOnGlass: isiOS ? 'rgba(15, 36, 59, 0.8)' : colors.textSecondary,
  destructiveTextOnGlass: isiOS ? '#8f001c' : colors.surface,
} as const;

