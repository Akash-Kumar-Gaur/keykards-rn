export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedThemeMode = 'light' | 'dark';

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value as ThemeMode);
}

export function resolveThemeMode(
  mode: ThemeMode,
  system: 'light' | 'dark' | 'unspecified' | null | undefined,
): ResolvedThemeMode {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}
