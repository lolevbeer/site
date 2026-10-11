/**
 * Light-mode muted text must meet WCAG AA (4.5:1) for body-size text against
 * the page background and the #f0f0f0 segmented-control trough. Parses the
 * real token values out of globals.css so a future palette tweak can't
 * silently regress contrast.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getThemeVars } from '@/lib/utils/display-theme'

const css = readFileSync(join(process.cwd(), 'src/app/(frontend)/globals.css'), 'utf8')
// Light tokens live in the top-level @theme block; dark ones under `.dark`.
const themeStart = css.indexOf('@theme {')
const theme = css.slice(themeStart, css.indexOf('\n}', themeStart))

function token(name: string): string {
  const match = theme.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`token --${name} not found in @theme`)
  return match[1]
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('light-mode muted-foreground contrast', () => {
  const muted = token('color-muted-foreground')

  it('is at least 4.5:1 on the page background', () => {
    expect(contrast(muted, token('color-background'))).toBeGreaterThanOrEqual(4.5)
  })

  // #f0f0f0 ≈ bg-black/[0.06] on white, the trough in components/ui/segmented-control.tsx.
  it('is at least 4.5:1 on the #f0f0f0 segmented-control trough', () => {
    expect(contrast(muted, '#f0f0f0')).toBeGreaterThanOrEqual(4.5)
  })
})

// Amber highlight text (ratings, Today, holiday notes): one token, so the
// next amber label can't regress contrast at a single call site.
describe('highlight contrast', () => {
  const dark = css.match(/\.dark \{[^}]*--color-highlight:\s*(#[0-9a-fA-F]{6})/)?.[1]

  it('is at least 4.5:1 on the light page background', () => {
    expect(contrast(token('color-highlight'), token('color-background'))).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  it('is at least 4.5:1 on the dark page background', () => {
    expect(contrast(dark!, '#000000')).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['light', 'dark'] as const)('TV %s boards meet AA with the highlight', (theme) => {
    const vars = getThemeVars(theme) as Record<string, string>
    expect(contrast(vars['--color-highlight'], vars['--color-background'])).toBeGreaterThanOrEqual(
      4.5,
    )
  })
})

// lib/utils/display-theme.ts hand-copies site tokens onto the TV boards; every
// copied value must match globals.css (@theme for light, `.dark` for dark).
describe('TV board theme vars mirror globals.css', () => {
  const darkStart = css.indexOf('  .dark {')
  const darkBlock = css.slice(darkStart, css.indexOf('}', darkStart))
  const darkToken = (name: string) =>
    darkBlock.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? token(name)

  it('sets every color token the dark theme overrides, so none follows the device theme', () => {
    const darkColors = [...darkBlock.matchAll(/(--color-[a-z-]+):\s*#/g)].map((m) => m[1])
    const boardVars = Object.keys(getThemeVars('dark'))
    expect(darkColors.filter((name) => !boardVars.includes(name))).toEqual([])
  })

  it('keeps the dark-mode noise overlay off live boards', () => {
    expect(css).toMatch(/\.dark body:not\(:has\(\[data-board\]\)\)::before/)
  })

  it.each(['light', 'dark'] as const)('%s board vars match the site tokens', (theme) => {
    const vars = Object.entries(getThemeVars(theme)).filter(([key]) => key.startsWith('--'))
    expect(vars.length).toBeGreaterThan(0)
    for (const [key, value] of vars) {
      const name = key.slice(2)
      expect([key, value]).toEqual([key, theme === 'light' ? token(name) : darkToken(name)])
    }
  })
})
