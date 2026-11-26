// @vitest-environment jsdom
/**
 * ScrollTour, the homepage's 3D tour shell. The scene (three.js) is mocked:
 * these tests cover what the page shows at each quality level, the rail, and
 * links to a stop.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ScrollTour } from '@/components/home/scroll-tour'
import { TOUR_STOPS } from '@/lib/tour/stops'

const tour = vi.hoisted(() => ({ quality: 'lite', fails: false, scenes: 0 }))

vi.mock('@/lib/utils/after-load-and-idle', () => ({
  afterLoadAndIdle: (fn: () => void) => (fn(), () => {}),
}))
vi.mock('@/lib/tour/quality', async (original) => ({
  ...(await original<typeof import('@/lib/tour/quality')>()),
  detectQuality: () => tour.quality,
}))
vi.mock('@/components/home/tour-scene', () => ({
  createTourScene: async () => {
    if (tour.fails) throw new Error('no WebGL')
    tour.scenes++
    return { renderAt: () => {}, setSize: () => {}, dispose: () => {} }
  },
}))

const can = { base: '/label.png' }
const renderTour = () => render(<ScrollTour can={can}>{() => <h1>Lolev Beer</h1>}</ScrollTour>)
const laterStops = TOUR_STOPS.slice(1)

beforeEach(() => {
  tour.quality = 'lite'
  tour.fails = false
  tour.scenes = 0
  window.location.hash = ''
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ScrollTour', () => {
  it('is the plain homepage on a device that gets no 3D', () => {
    tour.quality = 'none'
    const { container } = renderTour()
    expect(screen.getByRole('heading', { name: 'Lolev Beer' })).toBeTruthy()
    expect(container.querySelector('canvas')).toBeNull()
    expect(screen.queryByRole('heading', { name: laterStops[0].heading })).toBeNull()
  })

  it('is the plain homepage when no beer has label textures', () => {
    const { container } = render(<ScrollTour>{() => <h1>Lolev Beer</h1>}</ScrollTour>)
    expect(container.querySelector('canvas')).toBeNull()
    expect(screen.queryByRole('heading', { name: laterStops[0].heading })).toBeNull()
  })

  it('keeps every stop, with its heading and link, when the scene cannot be drawn', async () => {
    tour.fails = true
    const { container } = renderTour()
    await waitFor(() => expect(container.querySelector('canvas')).toBeNull())
    for (const stop of laterStops) {
      expect(screen.getByRole('heading', { name: stop.heading })).toBeTruthy()
      expect(screen.getByRole('link', { name: stop.cta }).getAttribute('href')).toBe(stop.href)
    }
    expect(screen.queryByRole('navigation', { name: 'Brewery tour' })).toBeNull()
  })

  it('draws the scene and marks the current stop on the rail', async () => {
    const { container } = renderTour()
    await waitFor(() => expect(tour.scenes).toBe(1))
    expect(container.querySelector('canvas')).not.toBeNull()
    const rail = screen.getByRole('navigation', { name: 'Brewery tour' })
    const links = [...rail.querySelectorAll('a')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      TOUR_STOPS.map((stop) => `#${stop.id}`),
    )
    expect(links.filter((link) => link.getAttribute('aria-current'))).toEqual([links[0]])
  })

  it('tells the hero when the scene is drawn behind it', async () => {
    render(<ScrollTour can={can}>{(behind) => <h1>{behind ? 'scene' : 'image'}</h1>}</ScrollTour>)
    expect(screen.getByRole('heading', { name: 'image' })).toBeTruthy()
    await screen.findByRole('heading', { name: 'scene' })
  })

  it('goes to the stop named in the address once the stops exist', () => {
    window.location.hash = '#seating'
    renderTour()
    const seating = document.getElementById('seating')
    expect(seating).not.toBeNull()
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toEqual([seating])
  })
})
