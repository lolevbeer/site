/**
 * Shared CSS variable definitions for live display components (TV menus, events boards).
 * Bypasses Next.js theme system via inline styles for maximum browser compatibility.
 */

/** Light mode CSS variables for live displays */
export const lightVars = {
  '--color-background': '#ffffff',
  '--color-foreground': '#1d1d1f',
  '--color-foreground-muted': '#6e6e73',
  '--color-card': '#ffffff',
  '--color-card-foreground': '#1d1d1f',
  '--color-primary': '#1d1d1f',
  '--color-primary-foreground': '#ffffff',
  '--color-secondary': '#f5f5f7',
  '--color-secondary-foreground': '#1d1d1f',
  '--color-muted': '#f2f2f2',
  '--color-muted-foreground': '#86868b',
  '--color-border': '#d2d2d7',
} as React.CSSProperties

/** Dark mode CSS variables for live displays */
export const darkVars = {
  '--color-background': '#000000',
  '--color-foreground': '#f5f5f7',
  '--color-foreground-muted': '#acacae',
  '--color-card': '#1d1d1f',
  '--color-card-foreground': '#f5f5f7',
  '--color-primary': '#ffffff',
  '--color-primary-foreground': '#000000',
  '--color-secondary': '#2c2c2e',
  '--color-secondary-foreground': '#f5f5f7',
  '--color-muted': '#2c2c2e',
  '--color-muted-foreground': '#98989d',
  '--color-border': '#38383a',
} as React.CSSProperties

/** Get the appropriate theme variables for a given theme mode */
export function getThemeVars(theme: 'light' | 'dark'): React.CSSProperties {
  return theme === 'dark' ? darkVars : lightVars
}
