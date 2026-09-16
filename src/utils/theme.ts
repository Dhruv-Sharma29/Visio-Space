export type ThemeId = 'dark-paper' | 'parchment-light' | 'high-contrast';

export const DEFAULT_THEME: ThemeId = 'dark-paper';
export const THEME_STORAGE_KEY = 'visiospace_theme';

const VALID_THEMES: readonly ThemeId[] = ['dark-paper', 'parchment-light', 'high-contrast'];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (VALID_THEMES as readonly string[]).includes(value);
}

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Applies the theme to the document immediately and remembers it locally
 *  so it survives a reload even before any profile has loaded. */
export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing / storage disabled — theme still applies for this session.
  }
}
