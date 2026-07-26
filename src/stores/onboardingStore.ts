/**
 * Onboarding store — in-memory mirror of the SecureStore "seen" flag.
 * Not persisted via Zustand; SecureStore is the source of truth.
 */

import { create } from 'zustand';
import { getOnboardingSeen, setOnboardingSeen } from '@/lib/onboarding';
import { logger } from '@/lib/logger';

interface OnboardingState {
  seen: boolean;
  ready: boolean;
  init: () => Promise<void>;
  markSeen: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  seen: false,
  ready: false,

  init: async () => {
    try {
      const seen = await getOnboardingSeen();
      set({ seen, ready: true });
    } catch (err) {
      logger.warn('Failed to read onboarding flag', err);
      set({ seen: false, ready: true });
    }
  },

  markSeen: async () => {
    try {
      await setOnboardingSeen();
      set({ seen: true });
    } catch (err) {
      logger.warn('Failed to persist onboarding flag', err);
      // Still advance locally so the user isn't stuck.
      set({ seen: true });
    }
  },
}));
