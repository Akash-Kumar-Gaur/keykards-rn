/**
 * App-level unlock session (in-memory only — never persisted).
 *
 * Biometric/PIN is a local device-unlock layer on top of an already-
 * authenticated Supabase session. Quick app switches under the timeout do NOT
 * re-prompt. Cold starts and long backgrounds do.
 *
 * Card-data reveal (Phase 2) is intentionally separate and always requires a
 * fresh biometric check via `requireFreshBiometric()` / decryptField — even if
 * the app was unlocked moments ago.
 */

import { authenticate } from './biometrics';

/**
 * How long the app may stay backgrounded before requiring unlock again.
 * 0 = instant lock: every return to the foreground re-prompts.
 */
export const APP_LOCK_TIMEOUT_MS = 0;

/** True when there is no grace period at all. */
export const INSTANT_APP_LOCK = APP_LOCK_TIMEOUT_MS === 0;

/** Epoch ms of last successful app-level unlock in this process. null = never. */
let lastUnlockedAt: number | null = null;

/** Epoch ms when the app last left the foreground. null = currently active / never left. */
let backgroundedAt: number | null = null;

export function getLastUnlockedAt(): number | null {
  return lastUnlockedAt;
}

export function getBackgroundedAt(): number | null {
  return backgroundedAt;
}

/** Call after a successful app-level biometric/PIN (or fail-open). */
export function markAppUnlocked(): void {
  lastUnlockedAt = Date.now();
  backgroundedAt = null;
}

/** Call the instant the app becomes inactive/backgrounded. */
export function markAppBackgrounded(): void {
  backgroundedAt = Date.now();
}

/**
 * Clear unlock/background stamps (e.g. sign-out or while lock is not enforced).
 * Next time a session becomes active, cold-start unlock is required again.
 */
export function resetAppLockSession(): void {
  lastUnlockedAt = null;
  backgroundedAt = null;
}

/**
 * Whether an app-level unlock prompt is required right now.
 * - Cold start (never unlocked this process) → true
 * - Backgrounded at least APP_LOCK_TIMEOUT_MS → true
 *   (with instant lock, that means any background at all)
 */
export function shouldRequireAppUnlock(options?: { force?: boolean }): boolean {
  if (options?.force) return true;
  if (lastUnlockedAt === null) return true;
  if (backgroundedAt === null) return false;
  return Date.now() - backgroundedAt >= APP_LOCK_TIMEOUT_MS;
}

/**
 * Evaluate a return-to-foreground. Clears the background stamp when resuming
 * within the timeout so subsequent checks stay clean. With instant lock this
 * always returns 'require_auth' once the app has been backgrounded.
 */
export function evaluateForegroundReturn(): 'require_auth' | 'resume' {
  if (shouldRequireAppUnlock()) return 'require_auth';
  backgroundedAt = null;
  return 'resume';
}

/**
 * SENSITIVE path — always a fresh biometric/PIN, independent of app unlock.
 * Use before decrypting/showing full card number or CVV (Phase 2 Vault).
 */
export async function requireFreshBiometric(
  reason = 'Reveal card details',
): Promise<boolean> {
  return authenticate(reason);
}
