/**
 * Typography tokens.
 *
 * Font families map to the fonts loaded via expo-font in `lib/fonts.ts`.
 * Headlines use Sora (bold geometric sans); body uses Plus Jakarta Sans.
 * Eyebrow labels are small-caps + letter-spaced.
 */

export const fontFamily = {
  // Sora — headlines / display
  display: 'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  displayExtra: 'Sora_800ExtraBold',
  // Plus Jakarta Sans — body / UI
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const fontSize = {
  eyebrow: 11,
  caption: 12,
  small: 13,
  body: 15,
  bodyLg: 17,
  title: 20,
  h2: 24,
  h1: 30,
  display: 34,
  stat: 26,
} as const;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.4,
} as const;

export const letterSpacing = {
  eyebrow: 1.6,
  tight: -0.4,
  normal: 0,
} as const;
