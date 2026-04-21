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
