/**
 * Onboarding persistence.
 *
 * Flags first-launch carousel as seen in expo-secure-store so it only ever
 * shows once per install. Not a secret — SecureStore is used for consistency
 * with the rest of on-device flags (and to avoid adding AsyncStorage).
 */

import { SECURE_KEYS, secureGet, secureSet } from './secureStore';

export async function getOnboardingSeen(): Promise<boolean> {
  const value = await secureGet(SECURE_KEYS.onboarded);
  return value === '1';
}

export async function setOnboardingSeen(): Promise<void> {
  await secureSet(SECURE_KEYS.onboarded, '1');
}
