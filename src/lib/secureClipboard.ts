/**
 * Secure clipboard helpers for sensitive card fields.
 *
 * SENSITIVE: never log `value`. After copy, schedule a clear that only runs
 * if the clipboard still holds the exact same string — never wipe blindly.
 */

import * as Clipboard from 'expo-clipboard';
import { logger } from '@/lib/logger';

export const CLIPBOARD_CLEAR_MS = 30_000;

const pendingClears = new Map<string, ReturnType<typeof setTimeout>>();

function cancelPending(token: string) {
  const t = pendingClears.get(token);
  if (t) {
    clearTimeout(t);
    pendingClears.delete(token);
  }
}

/**
 * Copy `value` to the clipboard and auto-clear after `ttlMs` **only if** the
 * clipboard still equals `value` at clear time.
 *
 * Returns a cancel handle for the scheduled clear (e.g. on unmount).
 */
export async function copyWithConditionalClear(
  value: string,
  ttlMs: number = CLIPBOARD_CLEAR_MS,
): Promise<{ cancel: () => void }> {
  // SENSITIVE: value must never enter logs.
  await Clipboard.setStringAsync(value);

  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  cancelPending(token);

  const timer = setTimeout(() => {
    pendingClears.delete(token);
    void (async () => {
      try {
        const current = await Clipboard.getStringAsync();
        // Only clear if nothing else has replaced our value.
        if (current === value) {
          await Clipboard.setStringAsync('');
          logger.info('Clipboard auto-cleared after sensitive copy');
        } else {
          logger.info('Clipboard clear skipped — contents changed');
        }
      } catch (err) {
        logger.warn('Clipboard auto-clear failed', err);
      }
    })();
  }, ttlMs);

  pendingClears.set(token, timer);

  return {
    cancel: () => cancelPending(token),
  };
}

/** Convenience copy with no auto-clear (last-4 / expiry / bank). */
export async function copyPlain(value: string): Promise<void> {
  await Clipboard.setStringAsync(value);
}
