'use client'

/**
 * 3D spinning beer can for beer detail pages: builds the shared can scene
 * (see ./can-scene) from the CMS-generated label textures and adds orbit
 * controls + auto-rotate.
 *
 * ponytail: always-on rAF instead of captiva's on-demand rendering — fine
 * for the single can on a beer page.
 */
import { useEffect, useRef } from 'react'
import { createCanScene } from './can-scene'

interface BeerCan3DProps {
  /** URL of the generated label artwork PNG (beer.labelBase). */
  baseUrl: string
  /** URL of the generated black/white metalness PNG (beer.labelMetalness). */
  metalnessUrl?: string
  /** Fires once the scene is assembled and the canvas is in the DOM —
   *  the parent uses this to fade out its poster image. */
  onReady?: () => void
  className?: string
}

export function BeerCan3D({ baseUrl, metalnessUrl, onReady, className = '' }: BeerCan3DProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let disposed = false
    let cleanup = () => {}

    ;(async () => {
      const [can, { OrbitControls }] = await Promise.all([
        createCanScene({
          width: el.clientWidth,
          height: el.clientHeight,
          base: baseUrl,
          metalness: metalnessUrl,
          pixelRatio: Math.min(window.devicePixelRatio, 2),
        }),
        import('three/addons/controls/OrbitControls.js'),
      ])
      if (disposed) {
        can.dispose()
        return
      }

      const controls = new OrbitControls(can.camera, can.renderer.domElement)
      controls.enableDamping = true
      controls.enableZoom = false
      controls.enablePan = false
      controls.autoRotate = true
      controls.autoRotateSpeed = -2

      // Append only once the scene is fully assembled so the first painted
      // frame is a finished can, then tell the parent to drop its poster.
      el.appendChild(can.renderer.domElement)
      onReady?.()

      // rAF auto-pauses on hidden tabs but not scrolled-out elements; the
      // observer stops rendering (GPU/battery) while the can is off-screen.
      let raf = 0
      const tick = () => {
        controls.update()
        can.render()
        raf = requestAnimationFrame(tick)
      }
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          if (!raf) raf = requestAnimationFrame(tick)
        } else {
          cancelAnimationFrame(raf)
          raf = 0
        }
      })
      io.observe(el)

      const ro = new ResizeObserver(() => {
        can.setSize(el.clientWidth, el.clientHeight)
      })
      ro.observe(el)

      cleanup = () => {
        cancelAnimationFrame(raf)
        io.disconnect()
        ro.disconnect()
        controls.dispose()
        can.renderer.domElement.remove()
        can.dispose()
      }
    })().catch(() => {
      // WebGL unavailable or an asset failed: leave the canvas unmounted so
      // BeerDetails keeps showing the flat label image.
    })

    return () => {
      disposed = true
      cleanup()
    }
  }, [baseUrl, metalnessUrl])

  return <div ref={ref} className={className} aria-hidden="true" />
}
