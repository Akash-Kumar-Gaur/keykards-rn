/**
 * Font map consumed by expo-font's `useFonts` in the root layout.
 *
 * Sora → headlines / display. Plus Jakarta Sans → body / UI.
 */

import {
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

export const appFonts = {
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} as const;
