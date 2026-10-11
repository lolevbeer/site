/**
 * Shared CSS variable definitions for live display components (TV menus, events boards).
 * Bypasses Next.js theme system via inline styles for maximum browser compatibility.
 *
 * The board theme comes from the menu, not the device's site theme, so every
 * token a board renders with must be set here or it falls through to `html`
 * (`.dark` when the device's site theme is dark). Values mirror globals.css;
 * tests/int/contrast-tokens.int.spec.ts fails if they drift.
 */

/** Light mode CSS variables for live displays */
const lightVars = {
  colorScheme: 'light',
  '--color-background': '#ffffff',
  '--color-foreground': '#1d1d1f',
  '--color-foreground-muted': '#6e6e73',
  '--color-highlight': '#bb4d00',
  '--color-card': '#ffffff',
  '--color-card-foreground': '#1d1d1f',
  '--color-card-interactive': '#fafafa',
  '--color-card-interactive-foreground': '#1d1d1f',
  '--color-popover': '#ffffff',
  '--color-popover-foreground': '#1d1d1f',
  '--color-primary': '#1d1d1f',
  '--color-primary-foreground': '#ffffff',
  '--color-secondary': '#f5f5f7',
  '--color-secondary-foreground': '#1d1d1f',
  '--color-muted': '#f2f2f2',
  '--color-muted-foreground': '#6a6a6f',
  '--color-accent': '#0071e3',
  '--color-accent-foreground': '#ffffff',
  '--color-destructive': '#ff3b30',
  '--color-destructive-foreground': '#ffffff',
  '--color-border': '#d2d2d7',
  '--color-input': '#f5f5f7',
  '--color-ring': '#0071e3',
} as React.CSSProperties

/** Dark mode CSS variables for live displays */
const darkVars = {
  colorScheme: 'dark',
  '--color-background': '#000000',
  '--color-foreground': '#f5f5f7',
  '--color-foreground-muted': '#acacae',
  '--color-highlight': '#ffb900',
  '--color-card': '#1d1d1f',
  '--color-card-foreground': '#f5f5f7',
  '--color-card-interactive': '#1d1d1f',
  '--color-card-interactive-foreground': '#f5f5f7',
  '--color-popover': '#1d1d1f',
  '--color-popover-foreground': '#f5f5f7',
  '--color-primary': '#ffffff',
  '--color-primary-foreground': '#000000',
  '--color-secondary': '#2c2c2e',
  '--color-secondary-foreground': '#f5f5f7',
  '--color-muted': '#2c2c2e',
  '--color-muted-foreground': '#98989d',
  '--color-accent': '#0a84ff',
  '--color-accent-foreground': '#ffffff',
  '--color-destructive': '#ff453a',
  '--color-destructive-foreground': '#ffffff',
  '--color-border': '#38383a',
  '--color-input': '#1c1c1e',
  '--color-ring': '#0a84ff',
} as React.CSSProperties

/** Get the appropriate theme variables for a given theme mode */
export function getThemeVars(theme: 'light' | 'dark'): React.CSSProperties {
  return theme === 'dark' ? darkVars : lightVars
}
