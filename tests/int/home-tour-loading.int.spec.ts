/**
 * The homepage must not ship three.js or the brewery model in its own bundle:
 * the tour loads them only when it starts (after load, on a capable device).
 * A static import in any of these files would put them in the page's first load.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(file, 'utf8')
/** Static, non-type imports of three.js, the scene or the model. */
const heavyImport =
  /^import (?!type\b)[^'"]*['"](three\b|[^'"]*tour-scene|[^'"]*lib\/hq\/)[^'"]*['"]/m

describe('homepage tour loading', () => {
  it.each([
    'components/home/home-content.tsx',
    'components/home/hero-section.tsx',
    'components/home/scroll-tour.tsx',
    'components/home/tour-scene.ts',
  ])('%s reaches three.js and the model only through dynamic imports', (file) => {
    expect(read(file)).not.toMatch(heavyImport)
  })

  it('the tour imports its scene dynamically', () => {
    expect(read('components/home/scroll-tour.tsx')).toMatch(/import\('\.\/tour-scene'\)/)
    expect(read('components/home/tour-scene.ts')).toMatch(/import\('three'\)/)
    expect(read('components/home/tour-scene.ts')).toMatch(/import\('@\/lib\/hq\/lolev-model'\)/)
  })

  it('the homepage renders the tour around its hero', () => {
    expect(read('components/home/home-content.tsx')).toMatch(/<ScrollTour\b/)
  })
})
