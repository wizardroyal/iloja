/**
 * Design tokens — single source of truth for the Iloja palette and type scale.
 * Ported from the reference HTML in /design/.
 */

export const colors = {
  // Brand greens — Forest is the primary, Grove the secondary
  forest: '#1A3C34',
  forestDeep: '#0D2E22',
  forestNight: '#0D2420',
  grove: '#2D6A4F',
  groveLight: '#3D8060',
  sage: '#4A8E6C',
  meadow: '#52A679',
  mint: '#A8D5B5',

  // Backgrounds — warm off-whites
  cream: '#F7F4EE',
  parchment: '#EDE9E0',
  oat: '#E8E4DA',
  border: '#E0DDD5',
  borderSoft: '#C8C4B8',

  // Text
  ink: '#1A1A18',
  inkMuted: '#5C5C54',
  inkSubtle: '#7A7A70',

  // Surface tints
  white: '#FFFFFF',
  successTint: '#EAF3DE',
  warningTint: '#FEF3D7',

  // Status / accent
  warning: '#C9921A',
  warningDeep: '#7A5008',
  danger: '#E05A2B',
  info: '#2D7DD2',
  infoDeep: '#4A7FB5',
  premium: '#6B4FBF',
} as const;

export const fonts = {
  display: "'Fraunces', ui-serif, Georgia, serif",
  body: "'DM Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
} as const;

export const radii = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  pill: '999px',
} as const;

export const shadows = {
  card: '0 2px 8px rgba(26, 60, 52, 0.08)',
  cardHover: '0 6px 24px rgba(26, 60, 52, 0.14)',
  modal: '0 12px 40px rgba(13, 46, 34, 0.18)',
} as const;

export const breakpoints = {
  // Reference UI is mobile-first at 390px
  mobile: '390px',
  tablet: '768px',
  desktop: '1024px',
} as const;

export const tokens = { colors, fonts, radii, shadows, breakpoints } as const;
export type Tokens = typeof tokens;
