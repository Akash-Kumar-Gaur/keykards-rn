/**
 * Ephemeral sensitive-data store (Zustand).
 *
 * SENSITIVE: holds decrypted card plaintext ONLY in memory, keyed by field id.
 * It is deliberately NOT persisted (no persist middleware, no AsyncStorage).
 * Entries auto-clear:
 *   - after AUTO_CLEAR_MS (~10s) from being set, and
 *   - immediately when the app backgrounds (wired in the AppState listener).
 *
 * Nothing here is ever logged. This store is not wired to any UI yet (Phase 2),
 * but the security scaffolding exists now so reveal flows drop straight in.
 */

import { create } from 'zustand';

const AUTO_CLEAR_MS = 10_000;

interface SensitiveState {
  /** fieldId -> decrypted plaintext (in-memory only). */
  revealed: Record<string, string>;
  reveal: (fieldId: string, plaintext: string) => void;
  clear: (fieldId: string) => void;
  clearAll: () => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelTimer(fieldId: string) {
  const t = timers.get(fieldId);
  if (t) {
    clearTimeout(t);
    timers.delete(fieldId);
  }
}

export const useSensitiveStore = create<SensitiveState>((set, get) => ({
  revealed: {},

  reveal: (fieldId, plaintext) => {
    cancelTimer(fieldId);
    set((s) => ({ revealed: { ...s.revealed, [fieldId]: plaintext } }));
    timers.set(
      fieldId,
      setTimeout(() => get().clear(fieldId), AUTO_CLEAR_MS),
    );
  },

  clear: (fieldId) => {
    cancelTimer(fieldId);
    set((s) => {
      if (!(fieldId in s.revealed)) return s;
      const next = { ...s.revealed };
      delete next[fieldId];
      return { revealed: next };
    });
  },

  clearAll: () => {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    set({ revealed: {} });
  },
}));

/** Clear all revealed plaintext — call on app background / lock. */
export function clearSensitiveData() {
  useSensitiveStore.getState().clearAll();
}

export { AUTO_CLEAR_MS };
