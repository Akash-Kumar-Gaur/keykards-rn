/**
 * InWallet color tokens — dark + light palettes with identical keys.
 *
 * Payment-card faces keep their own metallic presets (cardThemes.ts) in both
 * modes. These tokens drive app chrome: backgrounds, glass, text, nav, glow.
 */

export type AppPalette = {
  // Base surfaces
  navy950: string;
  navy900: string;
  navy850: string;
  navy800: string;

  // Glass / elevated panels
  glassFill: string;
  glassFillStrong: string;
  glassBorder: string;
  glassBorderStrong: string;

  // Accent
  indigo: string;
  indigoDeep: string;
  indigoSoft: string;
  indigoGlow: string;

  // Status
  amber: string;
  amberSoft: string;
  green: string;
  greenSoft: string;
  danger: string;
  dangerSoft: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;

  // Misc
  white: string;
  black: string;
  overlayScrim: string;
  trackBg: string;

  /** BlurView tint for glass chrome (tab bar, sheets). */
  blurTint: 'light' | 'dark';
  /** Soft ambient glow opacity multiplier (0–1) for GlowBackground. */
  glowIntensity: number;
  /**
   * Extra elevation for dark metallic payment cards on light pages
   * (shadow only — card face itself stays metallic).
   */
  cardOnCanvasShadow: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
};

/** Dark — near-black navy base (existing InWallet identity). */
export const darkPalette: AppPalette = {
  navy950: '#0A0A14',
  navy900: '#0E0E1C',
  navy850: '#12121F',
  navy800: '#161628',

  glassFill: 'rgba(255, 255, 255, 0.04)',
  glassFillStrong: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.12)',

  indigo: '#6C5CE7',
  indigoDeep: '#5B4FE0',
  indigoSoft: 'rgba(108, 92, 231, 0.16)',
  indigoGlow: 'rgba(108, 92, 231, 0.55)',

  amber: '#F5A524',
  amberSoft: 'rgba(245, 165, 36, 0.14)',
  green: '#22C55E',
  greenSoft: 'rgba(34, 197, 94, 0.14)',
  danger: '#F2555A',
  dangerSoft: 'rgba(242, 85, 90, 0.14)',

  textPrimary: '#F5F6FB',
  textSecondary: '#9AA0B4',
  textTertiary: '#6B7085',
  textOnAccent: '#FFFFFF',

  white: '#FFFFFF',
  black: '#000000',
  overlayScrim: 'rgba(10, 10, 20, 0.72)',
  trackBg: 'rgba(255, 255, 255, 0.08)',

  blurTint: 'dark',
  glowIntensity: 1,
  cardOnCanvasShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
};

/**
 * Light — warm off-white canvas (not pure white). Same indigo family, deeper
 * for contrast on light fills. Glass = soft white panel + border (no white-on-
 * dark highlight trick). Glow intensity reduced so ambiance ≠ colored smudge.
 */
export const lightPalette: AppPalette = {
  // Warm soft off-white / cream-gray (avoid harsh #FFF)
  navy950: '#F4F2EC',
  navy900: '#EBE8E0',
  navy850: '#E4E0D6',
  navy800: '#FFFFFF',

  glassFill: '#FFFFFF',
  glassFillStrong: '#FFFFFF',
  glassBorder: 'rgba(26, 32, 56, 0.08)',
  glassBorderStrong: 'rgba(26, 32, 56, 0.14)',

  // Slightly deeper indigo for WCAG contrast on warm white (~#F4F2EC)
  indigo: '#5B4CDB',
  indigoDeep: '#4A3CC7',
  indigoSoft: 'rgba(91, 76, 219, 0.16)',
  indigoGlow: 'rgba(91, 76, 219, 0.28)',

  amber: '#9A5B08',
  amberSoft: 'rgba(154, 91, 8, 0.16)',
  green: '#15803D',
  greenSoft: 'rgba(21, 128, 61, 0.16)',
  danger: '#C81E1E',
  dangerSoft: 'rgba(200, 30, 30, 0.12)',

  // Near-navy ink (reuse dark shell tones), not pure black
  textPrimary: '#141628',
  textSecondary: '#4A5168',
  textTertiary: '#6B7285',
  textOnAccent: '#FFFFFF',

  white: '#FFFFFF',
  black: '#000000',
  overlayScrim: 'rgba(20, 22, 40, 0.45)',
  trackBg: 'rgba(26, 32, 56, 0.06)',

  blurTint: 'light',
  glowIntensity: 0.16,
  /**
   * Soft, tight table-top lift — NOT a copy of dark's wide float shadow.
   * Wide/dark shadows on warm white read as a thick border/padding halo.
   */
  cardOnCanvasShadow: {
    shadowColor: '#1A2038',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
};

/** @deprecated Prefer usePalette() — static default stays dark for module-scope styles. */
export const palette: AppPalette = darkPalette;

export const darkGradients = {
  accent: ['#6C5CE7', '#5B4FE0'] as const,
  danger: ['#F2555A', '#D93A40'] as const,
  shimmer: [
    'rgba(255,255,255,0)',
    'rgba(255,255,255,0.35)',
    'rgba(255,255,255,0)',
  ] as const,
} as const;

export const lightGradients = {
  accent: ['#5B4CDB', '#4A3CC7'] as const,
  danger: ['#C81E1E', '#A01818'] as const,
  shimmer: [
    'rgba(255,255,255,0)',
    'rgba(255,255,255,0.55)',
    'rgba(255,255,255,0)',
  ] as const,
} as const;

/** @deprecated Prefer useGradients() from AppThemeProvider. */
export const gradients = darkGradients;

export type PaletteColor = keyof AppPalette;

export function paletteForMode(mode: 'light' | 'dark'): AppPalette {
  return mode === 'light' ? lightPalette : darkPalette;
}

export function gradientsForMode(mode: 'light' | 'dark') {
  return mode === 'light' ? lightGradients : darkGradients;
}
