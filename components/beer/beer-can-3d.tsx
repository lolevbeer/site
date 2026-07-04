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
  className?: string
}

export function BeerCan3D({ baseUrl, metalnessUrl, className = '' }: BeerCan3DProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let disposed = false
    let cleanup = () => {}

    ;(async () => {
      const can = await createCanScene({
        width: el.clientWidth,
        height: el.clientHeight,
        base: baseUrl,
        metalness: metalnessUrl,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
      })
      if (disposed) {
        can.dispose()
        return
      }

      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js')
      const controls = new OrbitControls(can.camera, can.renderer.domElement)
      controls.enableDamping = true
      controls.enableZoom = false
      controls.enablePan = false
      controls.autoRotate = true
      controls.autoRotateSpeed = -2

      // Append only now that the scene is fully assembled: BeerDetails hides
      // its flat poster image via a has-[canvas] variant, so the canvas must
      // not exist in the DOM until it has something to show.
      el.appendChild(can.renderer.domElement)

      let raf = 0
      const tick = () => {
        controls.update()
        can.render()
        raf = requestAnimationFrame(tick)
      }
      tick()

      const ro = new ResizeObserver(() => {
        can.camera.aspect = el.clientWidth / el.clientHeight
        can.camera.updateProjectionMatrix()
        can.renderer.setSize(el.clientWidth, el.clientHeight)
      })
      ro.observe(el)

      cleanup = () => {
        cancelAnimationFrame(raf)
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
