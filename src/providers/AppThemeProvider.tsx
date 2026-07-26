/**
 * App theme — Light / Dark / System preference actually swaps chrome tokens.
 *
 * Payment-card metallic faces stay dark in both modes (physical-card look).
 * Shell (bg, glass, text, nav, glow) follows resolvedMode.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import {
  darkPalette,
  gradientsForMode,
  lightPalette,
  paletteForMode,
  type AppPalette,
} from '@/theme/colors';
import {
  resolveThemeMode,
  type ResolvedThemeMode,
  type ThemeMode,
} from '@/lib/themePreference';
import { useThemePreferenceStore } from '@/stores/themePreferenceStore';

type AppGradients = ReturnType<typeof gradientsForMode>;

type AppThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  /** Always true once light tokens ship. */
  hasDistinctLightVisuals: boolean;
  palette: AppPalette;
  gradients: AppGradients;
  isLight: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function navigationThemeFor(mode: ResolvedThemeMode) {
  const p = paletteForMode(mode);
  const base = mode === 'light' ? DefaultTheme : DarkTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: p.navy950,
      card: p.navy950,
      text: p.textPrimary,
      primary: p.indigo,
      border: p.glassBorder,
    },
  };
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const mode = useThemePreferenceStore((s) => s.mode);
  const setMode = useThemePreferenceStore((s) => s.setMode);
  const resolvedMode = resolveThemeMode(mode, system);
  const isLight = resolvedMode === 'light';

  const value = useMemo<AppThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      setMode,
      hasDistinctLightVisuals: true,
      palette: isLight ? lightPalette : darkPalette,
      gradients: gradientsForMode(resolvedMode),
      isLight,
    }),
    [mode, resolvedMode, setMode, isLight],
  );

  const visualTheme = useMemo(
    () => navigationThemeFor(resolvedMode),
    [resolvedMode],
  );

  return (
    <AppThemeContext.Provider value={value}>
      <ThemeProvider value={visualTheme}>
        <StatusBar style={isLight ? 'dark' : 'light'} />
        {children}
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);
  if (!value) throw new Error('useAppTheme must be used within AppThemeProvider');
  return value;
}

/** Active chrome palette — use this instead of static `palette` for themeable UI. */
export function usePalette(): AppPalette {
  return useAppTheme().palette;
}

export function useGradients(): AppGradients {
  return useAppTheme().gradients;
}
