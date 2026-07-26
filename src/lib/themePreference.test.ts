import { isThemeMode, resolveThemeMode } from './themePreference';

describe('theme preference infrastructure', () => {
  it('accepts only supported modes', () => {
    expect(isThemeMode('light')).toBe(true);
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode('system')).toBe(true);
    expect(isThemeMode('sepia')).toBe(false);
  });

  it('resolves explicit modes independently of the system', () => {
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
  });

  it('resolves System and safely defaults unknown system state to dark', () => {
    expect(resolveThemeMode('system', 'light')).toBe('light');
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', null)).toBe('dark');
  });
});
