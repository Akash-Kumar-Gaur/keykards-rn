/**
 * Key recovery hooks — set up / change a recovery passphrase and restore the
 * data key on a new device.
 *
 * SECURITY: the passphrase is used only to derive a wrapping key locally. Only
 * the wrapped blob + salt + KDF iterations ever touch the network. The plaintext
 * data key and the passphrase are never uploaded or logged.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/authStore';
import {
  getRawDataKeyForRecoverySetup,
  hasLocalDataKey,
  storeRecoveredDataKey,
} from '@/lib/crypto';
import {
  PBKDF2_ITERATIONS,
  unwrapDataKey,
  wrapDataKey,
  type WrappedKeyRecord,
} from '@/lib/crypto/recovery';

export const recoveryKeys = {
  status: (userId: string) => ['key-recovery', 'status', userId] as const,
};

export interface RecoveryStatus {
  configured: boolean;
  updatedAt: string | null;
}

/** Whether the signed-in user has a recovery passphrase configured. */
export function useRecoveryStatus() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: recoveryKeys.status(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<RecoveryStatus> => {
      const { data, error } = await supabase
        .from('key_recovery')
        .select('updated_at')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) {
        logger.warn('Failed to read recovery status', error);
        throw error;
      }
      return { configured: Boolean(data), updatedAt: data?.updated_at ?? null };
    },
    staleTime: 30_000,
  });
}

/**
 * Set up or change the recovery passphrase: wrap the on-device data key under a
 * key derived from the passphrase and upsert only the wrapped material.
 */
export function useSetupRecovery() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (passphrase: string): Promise<void> => {
      if (!userId) throw new Error('Not signed in.');

      // SENSITIVE: raw key held only for the wrap, then scrubbed.
      const rawKey = await getRawDataKeyForRecoverySetup();
      let record: WrappedKeyRecord;
      try {
        record = await wrapDataKey(rawKey, passphrase, PBKDF2_ITERATIONS);
      } finally {
        rawKey.fill(0);
      }

      const { error } = await supabase.from('key_recovery').upsert(
        {
          user_id: userId,
          wrapped_key: record.wrappedKey,
          kdf_salt: record.kdfSalt,
          kdf_iterations: record.kdfIterations,
        },
        { onConflict: 'user_id' },
      );
      if (error) {
        logger.warn('Failed to upload wrapped key', error);
        throw error;
      }
    },
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: recoveryKeys.status(userId) });
      }
    },
  });
}

export type RecoveryAttemptResult =
  | { status: 'success' }
  | { status: 'wrong-passphrase'; failedCount: number; lockedUntil: string | null }
  | { status: 'locked'; retryAt: string }
  | { status: 'not-configured' }
  | { status: 'error'; message: string };

interface BeginRecoveryRow {
  is_locked: boolean;
  retry_at: string | null;
  wrapped_key: string | null;
  kdf_salt: string | null;
  kdf_iterations: number | null;
}

/**
 * Attempt to restore the data key on a new device using the recovery passphrase.
 * Server-side throttle is consulted first (begin_key_recovery), then the result
 * is recorded (record_key_recovery_result) so brute-forcing is limited even if
 * the client is patched.
 */
export async function attemptRecovery(
  passphrase: string,
): Promise<RecoveryAttemptResult> {
  // 1) Ask the server for the wrapped material (refused while locked out).
  const { data, error } = await supabase.rpc('begin_key_recovery');
  if (error) {
    logger.warn('begin_key_recovery failed', error);
    return { status: 'error', message: 'Could not reach the recovery service.' };
  }

  const row = (Array.isArray(data) ? data[0] : data) as BeginRecoveryRow | undefined;
  if (!row) {
    return { status: 'error', message: 'Unexpected recovery response.' };
  }
  if (row.is_locked && row.retry_at) {
    return { status: 'locked', retryAt: row.retry_at };
  }
  if (!row.wrapped_key || !row.kdf_salt || !row.kdf_iterations) {
    return { status: 'not-configured' };
  }

  // 2) Try to unwrap locally. A wrong passphrase throws (AES-GCM tag mismatch).
  let rawKey: Uint8Array | null = null;
  try {
    rawKey = await unwrapDataKey(
      {
        wrappedKey: row.wrapped_key,
        kdfSalt: row.kdf_salt,
        kdfIterations: row.kdf_iterations,
      },
      passphrase,
    );
  } catch {
    const outcome = await recordResult(false);
    return {
      status: 'wrong-passphrase',
      failedCount: outcome?.failedCount ?? 0,
      lockedUntil: outcome?.lockedUntil ?? null,
    };
  }

  // 3) Persist the recovered key on this device, then record success.
  try {
    await storeRecoveredDataKey(rawKey);
  } finally {
    rawKey.fill(0);
  }
  await recordResult(true);
  return { status: 'success' };
}

async function recordResult(
  success: boolean,
): Promise<{ failedCount: number; lockedUntil: string | null } | null> {
  const { data, error } = await supabase.rpc('record_key_recovery_result', {
    p_success: success,
  });
  if (error) {
    logger.warn('record_key_recovery_result failed', error);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { failed_count: number; locked_until: string | null }
    | undefined;
  return row
    ? { failedCount: row.failed_count, lockedUntil: row.locked_until }
    : null;
}

/**
 * New-device check: is there a session but no local data key, and does the user
 * have recovery configured / existing cards? Drives the post-sign-in prompt.
 */
export async function assessNewDeviceState(): Promise<{
  hasKey: boolean;
  recoveryConfigured: boolean;
  hasServerCards: boolean;
}> {
  const hasKey = await hasLocalDataKey();
  if (hasKey) {
    return { hasKey: true, recoveryConfigured: false, hasServerCards: false };
  }

  const userId = useAuthStore.getState().user?.id;
  if (!userId) {
    return { hasKey: false, recoveryConfigured: false, hasServerCards: false };
  }

  const [recovery, cards] = await Promise.all([
    supabase.from('key_recovery').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('cards').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  return {
    hasKey: false,
    recoveryConfigured: Boolean(recovery.data),
    hasServerCards: (cards.count ?? 0) > 0,
  };
}
