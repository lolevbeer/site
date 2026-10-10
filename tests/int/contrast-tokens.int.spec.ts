/**
 * Light-mode muted text must meet WCAG AA (4.5:1) for body-size text against
 * the page background and the #f0f0f0 segmented-control trough. Parses the
 * real token values out of globals.css so a future palette tweak can't
 * silently regress contrast.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

  it('is at least 4.5:1 on the #f0f0f0 segmented-control trough', () => {
    expect(contrast(muted, '#f0f0f0')).toBeGreaterThanOrEqual(4.5)
  })
})
