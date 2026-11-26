'use client'

/**
 * The homepage scroll tour: wraps the hero and, once the page has loaded on a
 * device that can draw it, adds four more stops below it and a 3D scene of the
 * brewery behind them all. Scrolling moves the scene's camera from stop to stop.
 *
 * Until then, and for good on a device that gets no 3D (see lib/tour/quality),
 * it renders only its children: the server's HTML is the plain homepage.
 *
 * Scrolling is the browser's own. A passive scroll listener asks for one
 * animation frame, and a frame is drawn only then or on a resize. three.js and
 * the scene (./tour-scene) are imported only when the tour starts.
 */
import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { progressFromTops, stopAt } from '@/lib/tour/pose'
import { createFrameBudget, detectQuality, stepDown, type TourQuality } from '@/lib/tour/quality'
import { TOUR_STOPS, type TourStopId } from '@/lib/tour/stops'
import { afterLoadAndIdle } from '@/lib/utils/after-load-and-idle'
import { cn } from '@/lib/utils'

/** The beer whose can stands in the scene. */
export interface TourCan {
  /** URLs of its generated label textures (beer.labelBase, beer.labelMetalness). */
  base: string
  metalness?: string
}

interface ScrollTourProps {
  /** Omit when no beer has label textures; the page then stays the plain homepage. */
  can?: TourCan
  /** The hero, which is the first stop. It is told when the scene is drawn
   *  behind it, so it can fade its own background image out. */
  children: (sceneBehind: boolean) => ReactNode
}

export function ScrollTour({ can, children }: ScrollTourProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const root = useRef<HTMLDivElement>(null)
  /** Each stop's element, in TOUR_STOPS order. */
  const stops = useRef<(HTMLElement | null)[]>([])
  // null: the tour has not started and the page is the plain homepage. 'none'
  // after it started: the scene failed or was too slow; the stops stay, undrawn.
  const [quality, setQuality] = useState<TourQuality | null>(null)
  const [drawn, setDrawn] = useState(false)
  const [current, setCurrent] = useState<TourStopId>(TOUR_STOPS[0].id)
  const started = quality !== null
  const { base, metalness } = can ?? {}

  // Start once the page has loaded and is idle, so the hero image stays the
  // first thing painted.
  useEffect(() => {
    if (!base) return
    return afterLoadAndIdle(() => {
      const picked = detectQuality()
      // A visitor already reading further down keeps the page they have:
      // adding the stops above them would push it away.
      if (picked !== 'none' && window.scrollY < window.innerHeight / 2) setQuality(picked)
    })
  }, [base])

  // A link to a stop (/#bar) finds nothing until the stops exist; go there now.
  useEffect(() => {
    if (!started) return
    const id = window.location.hash.slice(1)
    if (TOUR_STOPS.some((stop) => stop.id === id)) document.getElementById(id)?.scrollIntoView()
  }, [started])

  useEffect(() => {
    const el = canvas.current
    if (!base || !el || (quality !== 'full' && quality !== 'lite')) return
    let disposed = false
    let cleanup = () => {}

    import('./tour-scene')
      .then(({ createTourScene }) =>
        createTourScene({ canvas: el, quality, label: { base, metalness } }),
      )
      .then((scene) => {
        if (disposed) return scene.dispose()
        const budget = createFrameBudget()
        let frame = 0

        const draw = (now: number) => {
          frame = 0
          // Scrolled past the tour: nothing of it is on screen.
          if ((root.current?.getBoundingClientRect().bottom ?? 0) <= 0) return
          const progress = progressFromTops(
            stops.current.map((stop) => stop?.getBoundingClientRect().top ?? 0),
          )
          scene.renderAt(progress)
          setCurrent(stopAt(progress))
          // The next frame's start is when this one reached the screen. Too slow
          // on average and the tour drops a level; this effect then runs again.
          requestAnimationFrame((next) => {
            if (!disposed && budget.add(next - now)) setQuality(stepDown(quality))
          })
        }
        const schedule = () => {
          frame ||= requestAnimationFrame(draw)
        }

        window.addEventListener('scroll', schedule, { passive: true })
        // Fires once on observe, which sizes the scene and draws its first frame.
        const resize = new ResizeObserver(() => {
          scene.setSize(el.clientWidth, el.clientHeight)
          schedule()
        })
        resize.observe(el)
        setDrawn(true)

        cleanup = () => {
          window.removeEventListener('scroll', schedule)
          resize.disconnect()
          cancelAnimationFrame(frame)
          scene.dispose()
        }
      })
      .catch(() => {
        // No WebGL after all, or the model or a texture failed to load.
        if (!disposed) setQuality('none')
      })

    return () => {
      disposed = true
      cleanup()
      setDrawn(false)
    }
  }, [base, metalness, quality])

  const scene = quality === 'full' || quality === 'lite'

  return (
    <div ref={root} className="relative isolate">
      {scene && (
        // Before the hero in the document, so the hero's own scrim paints over it.
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <canvas
            // A new canvas per level: the old one's WebGL context is released.
            key={quality}
            ref={canvas}
            className={cn(
              'sticky top-0 block h-screen w-full transition-opacity duration-700',
              drawn ? 'opacity-100' : 'opacity-0',
            )}
          />
        </div>
      )}

      <div
        id={TOUR_STOPS[0].id}
        ref={(el) => {
          stops.current[0] = el
        }}
      >
        {children(drawn)}
      </div>

      {started &&
        TOUR_STOPS.slice(1).map((stop, index) => (
          <section
            key={stop.id}
            id={stop.id}
            ref={(el) => {
              stops.current[index + 1] = el
            }}
            aria-labelledby={`${stop.id}-heading`}
            className={cn(
              'relative z-10 flex items-end px-4 py-16 md:items-center md:px-12',
              // A screen each while the scene is behind them; a plain list without it.
              scene && 'min-h-screen',
            )}
          >
            <div className="max-w-md rounded-xl bg-background/85 p-6 shadow-lg">
              <h2 id={`${stop.id}-heading`} className="mb-2 text-3xl font-bold">
                {stop.heading}
              </h2>
              <p className="mb-4 text-muted-foreground">{stop.text}</p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={stop.href} prefetch={false}>
                    {stop.cta}
                  </Link>
                </Button>
                {stop.also && (
                  <Button asChild variant="outline">
                    <Link href={stop.also.href} prefetch={false}>
                      {stop.also.cta}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </section>
        ))}

      {scene && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <nav
            aria-label="Brewery tour"
            className="sticky top-0 flex h-screen flex-col items-end justify-center gap-3 pr-3 md:pr-5"
          >
            {TOUR_STOPS.map((stop) => (
              <a
                key={stop.id}
                href={`#${stop.id}`}
                aria-label={stop.label}
                aria-current={stop.id === current ? 'location' : undefined}
                className="pointer-events-auto flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    'block rounded-full bg-foreground transition-all',
                    stop.id === current ? 'size-3' : 'size-2 opacity-50',
                  )}
                />
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}
