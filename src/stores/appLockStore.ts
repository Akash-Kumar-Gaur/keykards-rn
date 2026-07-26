/**
 * App-lock store (Zustand) — UI mirror of lock state.
 *
 * Unlock timestamps live in `lib/appLockSession` (in-memory module state), not
 * here and never on disk. This store only tracks whether the gate UI is open
 * and whether a Vault-like screen is active (forces re-lock on background).
 */

import { create } from 'zustand';

interface AppLockState {
  unlocked: boolean;
  /** True while a screen showing card details is active. */
  sensitiveScreenActive: boolean;
  unlock: () => void;
  lock: () => void;
  setSensitiveScreenActive: (active: boolean) => void;
}

export const useAppLockStore = create<AppLockState>((set) => ({
  unlocked: false,
  sensitiveScreenActive: false,
  unlock: () => set({ unlocked: true }),
  lock: () => set({ unlocked: false }),
  setSensitiveScreenActive: (active) => set({ sensitiveScreenActive: active }),
}));
