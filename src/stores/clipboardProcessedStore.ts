/**
 * Persist last-processed clipboard content hash (non-sensitive).
 * Prevents re-triggering the confirm sheet when the same paste is still
 * on the clipboard after background → foreground.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'keykards.lastProcessedClipboardHash';

/** Simple non-crypto string hash — fine for clipboard de-dupe. */
export function hashClipboardText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Mix length so tiny collisions are less likely across short vs long pastes.
  return `v1:${normalized.length.toString(16)}:${(h >>> 0).toString(16)}`;
}

type State = {
  lastHash: string | null;
  ready: boolean;
  init: () => Promise<void>;
  markProcessed: (text: string) => Promise<void>;
  isAlreadyProcessed: (text: string) => boolean;
};

export const useClipboardProcessedStore = create<State>((set, get) => ({
  lastHash: null,
  ready: false,

  init: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      set({ lastHash: stored, ready: true });
    } catch (err) {
      logger.warn('Failed to read clipboard processed hash', err);
      set({ lastHash: null, ready: true });
    }
  },

  markProcessed: async (text: string) => {
    const hash = hashClipboardText(text);
    set({ lastHash: hash });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, hash);
    } catch (err) {
      logger.warn('Failed to persist clipboard processed hash', err);
    }
  },

  isAlreadyProcessed: (text: string) => {
    const { lastHash } = get();
    if (!lastHash || !text.trim()) return false;
    return lastHash === hashClipboardText(text);
  },
}));

/**
 * Forget the last-processed paste. Needed after a data wipe so clipboard
 * content that was already imported is offered again instead of being skipped.
 */
export async function clearProcessedClipboardHash(): Promise<boolean> {
  useClipboardProcessedStore.setState({ lastHash: null });
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    logger.warn('Failed to clear clipboard processed hash', err);
    return false;
  }
}
