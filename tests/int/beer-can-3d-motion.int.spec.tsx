/**
 * BeerCan3D respects the visitor's motion and scrolling needs:
 * - auto-rotate stays off under `prefers-reduced-motion: reduce`;
 * - the canvas lets vertical swipes scroll the page (OrbitControls sets
 *   `touch-action: none`, which would trap a phone visitor on the can).
 *
 * three.js is mocked: createCanScene returns a bare canvas and OrbitControls
 * mimics the real constructor's touch-action write.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { BeerCan3D } from '@/components/beer/beer-can-3d'

const created: Array<{ autoRotate: boolean; listeners: Record<string, () => void> }> = []
const renders = { count: 0 }

vi.mock('@/components/beer/can-scene', () => ({
  createCanScene: async () => ({
    camera: {},
    renderer: { domElement: document.createElement('canvas') },
    render: () => {
      renders.count++
    },
    setSize: () => {},
    dispose: () => {},
  }),
}))

vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    autoRotate = false
    listeners: Record<string, () => void> = {}
    constructor(_camera: unknown, dom: HTMLElement) {
      dom.style.touchAction = 'none'
      created.push(this)
    }
    update() {}
    addEventListener(type: string, fn: () => void) {
      this.listeners[type] = fn
    }
    dispose() {}
  },
}))

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion: reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  created.length = 0
  renders.count = 0
  // Report the can as on-screen so the render loop starts.
  globalThis.IntersectionObserver = class {
    constructor(private cb: IntersectionObserverCallback) {}
    observe() {
      this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never)
    }
    disconnect() {}
  } as unknown as typeof IntersectionObserver
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(cleanup)

async function renderCan() {
  const onReady = vi.fn()
  const { container } = render(<BeerCan3D baseUrl="/label.png" onReady={onReady} />)
  await waitFor(() => expect(onReady).toHaveBeenCalled())
  return container.querySelector('canvas') as HTMLCanvasElement
}

describe('BeerCan3D motion and touch', () => {
  it('auto-rotates when the visitor has no motion preference', async () => {
    mockReducedMotion(false)
    await renderCan()
    expect(created[0].autoRotate).toBe(true)
  })

  it('does not auto-rotate under prefers-reduced-motion: reduce', async () => {
    mockReducedMotion(true)
    await renderCan()
    expect(created[0].autoRotate).toBe(false)
  })

  it('renders only on demand under reduced motion instead of every frame', async () => {
    mockReducedMotion(true)
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })
    await renderCan()
    // One frame on entering view, no self-scheduled loop.
    expect(raf).toHaveBeenCalledTimes(1)
    expect(renders.count).toBe(1)
    created[0].listeners.change()
    expect(renders.count).toBe(2)
    raf.mockRestore()
  })

  it('lets vertical swipes over the canvas scroll the page', async () => {
    mockReducedMotion(false)
    const canvas = await renderCan()
    expect(canvas.style.touchAction).toBe('pan-y')
  })
})
