/**
 * useAppLock — centralized app-level biometric gate.
 *
 * Mounted at the root (via AppLockGate) so AppState listeners stay attached
 * across onboarding / sign-in / unlock transitions. Lock UI is only enforced
 * when `enforce` is true (onboarding seen + valid session) and is presented as
 * an overlay — the navigation stack stays mounted underneath.
 *
 * Supabase session is independent — this only gates local device unlock.
 * Card reveal must call `requireFreshBiometric()` separately (always fresh).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { authenticate, getBiometricCapability } from '@/lib/biometrics';
import {
  evaluateForegroundReturn,
  markAppBackgrounded,
  markAppUnlocked,
  requireFreshBiometric,
  resetAppLockSession,
  shouldRequireAppUnlock,
} from '@/lib/appLockSession';
import { useAppLockStore } from '@/stores/appLockStore';
import { clearSensitiveData } from '@/stores/sensitiveStore';

/** Window after a prompt during which AppState changes are ignored. */
const PROMPT_STATE_GRACE_MS = 1500;

export function useAppLock(options: { enforce: boolean }) {
  const { enforce } = options;
  const unlocked = useAppLockStore((s) => s.unlocked);
  const unlockStore = useAppLockStore((s) => s.unlock);
  const lockStore = useAppLockStore((s) => s.lock);
  const [checking, setChecking] = useState(false);
  const [canAuthenticate, setCanAuthenticate] = useState(true);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const prompting = useRef(false);
  /**
   * The OS biometric sheet itself pushes the app to `inactive`. With a zero
   * timeout that would re-arm the lock the moment it closes, so ignore state
   * changes during the prompt and briefly after it resolves.
   */
  const ignoreStateUntil = useRef(0);
  const enforceRef = useRef(enforce);
  enforceRef.current = enforce;

  const unlock = useCallback(() => {
    markAppUnlocked();
    unlockStore();
  }, [unlockStore]);

  const lock = useCallback(() => {
    lockStore();
  }, [lockStore]);

  const promptUnlock = useCallback(async () => {
    if (!enforceRef.current) return false;
    if (prompting.current) return false;
    prompting.current = true;
    setChecking(true);

    try {
      const cap = await getBiometricCapability();
      setCanAuthenticate(cap.canAuthenticate);

      if (!cap.canAuthenticate) {
        unlock();
        return true;
      }

      const ok = await authenticate('Unlock InWallet');
      if (ok) {
        unlock();
        return true;
      }
      return false;
    } finally {
      prompting.current = false;
      ignoreStateUntil.current = Date.now() + PROMPT_STATE_GRACE_MS;
      setChecking(false);
    }
  }, [unlock]);

  // When enforce turns on/off: sequence lock after session, never during
  // onboarding/sign-in. Re-check every time this branch is entered.
  useEffect(() => {
    let cancelled = false;

    if (!enforce) {
      resetAppLockSession();
      lockStore();
      setChecking(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      if (!shouldRequireAppUnlock()) {
        if (!cancelled) unlock();
        setChecking(false);
        return;
      }
      if (!cancelled) {
        lock();
        await promptUnlock();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enforce, lock, lockStore, promptUnlock, unlock]);

  // Background / foreground — always attached at root (gate stays mounted).
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const leaving =
        appState.current === 'active' && next.match(/inactive|background/);
      const returning =
        appState.current.match(/inactive|background/) && next === 'active';

      if (prompting.current || Date.now() < ignoreStateUntil.current) {
        appState.current = next;
        return;
      }

      if (leaving) {
        // SENSITIVE: never let decrypted plaintext survive leaving the foreground.
        clearSensitiveData();
        // Only a real background arms the lock; a transient `inactive`
        // (Control Center, call banner, system sheet) just blurs.
        if (next === 'background') {
          markAppBackgrounded();
          if (enforceRef.current) lock();
        }
      }

      if (returning) {
        if (!enforceRef.current) {
          appState.current = next;
          return;
        }
        if (evaluateForegroundReturn() === 'require_auth') {
          lock();
          await promptUnlock();
        }
      }

      appState.current = next;
    });
    return () => sub.remove();
  }, [lock, promptUnlock]);

  return {
    unlocked,
    checking,
    canAuthenticate,
    promptUnlock,
    lock,
    unlock,
    /** Phase 2: always-fresh check before showing card PAN/CVV. */
    requireCardRevealAuth: requireFreshBiometric,
  };
}
