/**
 * The site's copy of the brewery model (lib/hq/lolev-model.js) is generated in
 * lolevbeer/hq and copied here by scripts/sync-hq-model.mjs. These checks fail
 * if the copy was edited by hand, copied without the script, or lost its photos.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('lib/hq/lolev-model.js', 'utf8')
const photos = readdirSync('public/3d/hq')

describe('pinned copy of the HQ model', () => {
  it('names the hq commit it was copied from on its first line', () => {
    expect(source.split('\n')[0]).toMatch(/lolevbeer\/hq@[0-9a-f]{40}\b/)
  })

  it('exports buildModel and VIEWS', () => {
    expect(source).toMatch(/^export async function buildModel\(/m)
    expect(source).toMatch(/^export \{ VIEWS \}/m)
  })

  it('imports nothing, so the tour chooses when three.js loads', () => {
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\bimport\(/)
  })

  it('has every photo at both sizes', () => {
    const full = photos.filter((name) => !name.endsWith('.lite.webp'))
    expect(full.length).toBeGreaterThan(0)
    for (const name of full) {
      expect(photos).toContain(name.replace(/\.webp$/, '.lite.webp'))
    }
  })
})
