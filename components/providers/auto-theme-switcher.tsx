'use client';

/**
 * AutoThemeSwitcher is no longer needed for menu pages.
 * Theme is now handled by useMenuStream which gets the theme from the server,
 * respecting the menu's themeMode setting (auto/light/dark).
 *
 * This component is kept as a no-op for backwards compatibility.
 */
export function AutoThemeSwitcher() {
  return null;
}
