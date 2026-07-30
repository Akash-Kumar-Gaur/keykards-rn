import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  isThemeMode,
  type ThemeMode,
} from '@/lib/themePreference';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'inwallet.themeMode.v1';

type ThemePreferenceState = {
  mode: ThemeMode;
  ready: boolean;
  init: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
};

export const useThemePreferenceStore = create<ThemePreferenceState>((set) => ({
  mode: 'dark',
  ready: false,

  init: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      set({ mode: isThemeMode(stored) ? stored : 'dark', ready: true });
    } catch (err) {
      logger.warn('Failed to read theme preference', err);
      set({ mode: 'dark', ready: true });
    }
  },

  setMode: async (mode) => {
    set({ mode });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch (err) {
      logger.warn('Failed to persist theme preference', err);
    }
  },
}));
