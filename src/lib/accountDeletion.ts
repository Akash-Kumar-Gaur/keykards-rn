/**
 * Account deletion — client side.
 *
 * Server cascade + auth.users delete live in the `delete-account` Edge Function
 * (service role). After a verified success, wipe every local secret so this
 * device cannot keep decrypting or reusing a stale session.
 */

import { supabase } from '@/lib/supabase';
import {
  SECURE_KEYS,
  secureDelete,
  secureStoreAdapter,
} from '@/lib/secureStore';
import { clearSensitiveData } from '@/stores/sensitiveStore';
import { clearProcessedClipboardHash } from '@/stores/clipboardProcessedStore';
import { logger } from '@/lib/logger';
import { SUPPORT_EMAIL } from '@/lib/support';

function supabaseAuthStorageKey(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  try {
    const host = new URL(url).hostname;
    const ref = host.split('.')[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return 'supabase.auth.token';
  }
}

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Wipe on-device secrets after the server confirms the account is gone.
 * Safe to call even if some keys are already absent.
 */
export async function clearLocalAccountData(): Promise<void> {
  clearSensitiveData();
  await clearProcessedClipboardHash();
  await Promise.all([
    secureDelete(SECURE_KEYS.dataKey),
    secureDelete(SECURE_KEYS.onboarded),
    secureDelete(SECURE_KEYS.shareLinkKeys),
    secureStoreAdapter.removeItem(SECURE_KEYS.supabaseSession),
    secureStoreAdapter.removeItem(supabaseAuthStorageKey()),
  ]);
}

/**
 * Invoke the delete-account Edge Function, then clear local state.
 * On failure, does NOT sign out — the account may still exist server-side.
 */
export async function deleteAccountRemote(): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: {},
  });

  if (error) {
    logger.warn('delete-account invoke failed', error);
    return {
      ok: false,
      message:
        error.message ||
        `Account deletion failed before completion. Email ${SUPPORT_EMAIL} so we can verify and finish the wipe.`,
    };
  }

  const body = data as {
    ok?: boolean;
    error?: string;
    step?: string;
  } | null;

  if (!body?.ok) {
    logger.warn('delete-account rejected', body);
    return {
      ok: false,
      message:
        body?.error ||
        `Account deletion did not complete. Email ${SUPPORT_EMAIL} with details so we can finish removing your data.`,
    };
  }

  try {
    await clearLocalAccountData();
    // Local-only — auth user is already gone server-side.
    await supabase.auth.signOut({ scope: 'local' });
  } catch (err) {
    logger.warn('Local wipe after delete-account failed', err);
    // Server delete succeeded; still report success but note local cleanup.
  }

  return { ok: true };
}
