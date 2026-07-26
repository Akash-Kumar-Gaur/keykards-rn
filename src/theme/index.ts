/**
 * KeyKards theme.
 *
 * Central design-system export. Chrome colors: prefer `usePalette()` from
 * AppThemeProvider so Light/Dark swap. Static `palette` remains the dark set
 * for module-scope StyleSheets and payment-card-adjacent defaults.
 */

import { palette, gradients, darkPalette, lightPalette } from './colors';
import { fontFamily, fontSize, lineHeight, letterSpacing } from './typography';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  accent: {
    shadowColor: darkPalette.indigo,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
} as const;

/** Standard entrance-animation timings (ms). */
export const motion = {
  entranceDuration: 520,
  staggerStep: 80,
  progressDuration: 800,
  glowCycle: 4200,
  shimmerCycle: 3600,
  springConfig: { damping: 15, stiffness: 180, mass: 0.9 },
} as const;

export const theme = {
  colors: palette,
  gradients,
  spacing,
  radius,
  shadow,
  motion,
  font: fontFamily,
  fontSize,
  lineHeight,
  letterSpacing,
} as const;

export type Theme = typeof theme;

export {
  palette,
  gradients,
  darkPalette,
  lightPalette,
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing,
};
export type { AppPalette, PaletteColor } from './colors';
export { paletteForMode, gradientsForMode } from './colors';
