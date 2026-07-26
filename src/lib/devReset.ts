/**
 * TEMPORARY — wipe local app state on every reload in __DEV__.
 *
 * Lets you re-test splash → onboarding → auth/Home without manually clearing
 * SecureStore. Set DEV_CLEAR_ON_RELOAD to false (or delete this call) before shipping.
 */

import { SECURE_KEYS, secureDelete, secureStoreAdapter } from './secureStore';
import { supabase } from './supabase';
import { logger } from './logger';

/**
 * Flip to true only when re-testing splash → onboarding from a clean slate.
 * Leave false so session + lock timeout can be tested across reloads
 * (background 5+ min → unlock screen).
 */
export const DEV_CLEAR_ON_RELOAD = false;

function supabaseAuthStorageKey(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  try {
    const host = new URL(url).hostname; // e.g. kjmlfrxmsrvopxecqwdd.supabase.co
    const ref = host.split('.')[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return 'supabase.auth.token';
  }
}

export async function clearDevDataOnReload(): Promise<void> {
  if (!__DEV__ || !DEV_CLEAR_ON_RELOAD) return;

  try {
    await Promise.all([
      secureDelete(SECURE_KEYS.onboarded),
      secureDelete(SECURE_KEYS.dataKey),
      secureStoreAdapter.removeItem(SECURE_KEYS.supabaseSession),
      secureStoreAdapter.removeItem(supabaseAuthStorageKey()),
    ]);
    await supabase.auth.signOut({ scope: 'local' });
    logger.info('[dev] Cleared onboarding + session for reload testing');
  } catch (err) {
    logger.warn('[dev] Failed to clear data on reload', err);
  }
}
