/**
 * BlurFade motion primitive.
 * Wraps children with a blur-to-sharp entrance animation using Framer Motion.
 */

'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import { EASE_OUT_SMOOTH } from './constants'

/**
 * True after the first client commit of any BlurFade or MotionHydrationSentinel.
 * Module-scoped (not React state) so a BlurFade mounted later — e.g. App Router
 * swapping in a new tree on navigation — sees the value on its first render.
 * A per-instance flag would stay false on every new tree and skip the entrance
 * animation. Never reset in production.
 *
 * Components read it through `useSyncExternalStore` rather than touching the
 * variable during render. A bare read tears by design: React renders a subtree
 * whenever it likes, so a page hydrating under a Suspense boundary could see
 * the flag already flipped by the sentinel in the layout above it, render
 * `hidden`, and contradict the `opacity: 1` in the SSR HTML it was hydrating
 * against — an intermittent hydration mismatch. The store's server snapshot is
 * always `false`, so hydration renders mirror the server markup by
 * construction.
 */
let hasAppHydrated = false
const listeners = new Set<() => void>()

function markAppHydrated() {
  if (hasAppHydrated) return
  hasAppHydrated = true
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => hasAppHydrated
/** Hydration renders always take this path, so they mirror the SSR output. */
const getServerSnapshot = () => false

/** Test-only: reset the hydration flag between cases. */
export function __resetBlurFadeHydrationForTests() {
  hasAppHydrated = false
  listeners.forEach((listener) => listener())
}

/**
 * Sole writer of `hasAppHydrated`, flipping it on the app's first client
 * commit. Rendered once in `(frontend)/layout.tsx`, which is an ancestor of
 * every BlurFade consumer — so the flag is set even on pages that render no
 * BlurFade of their own (/privacy, /terms, /beer-map), which is exactly the
 * case a per-BlurFade effect used to miss. Any new tree using BlurFade must
 * stay under that layout, or mount this sentinel itself.
 */
export function MotionHydrationSentinel() {
  useEffect(markAppHydrated, [])
  return null
}

interface BlurFadeProps {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
  blur?: number
  yOffset?: number
  inView?: boolean
  inViewMargin?: string
}

const variants: Variants = {
  hidden: (custom: { blur: number; yOffset: number }) => ({
    opacity: 0,
    filter: `blur(${custom.blur}px)`,
    y: custom.yOffset,
    scale: 1.02,
  }),
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    scale: 1,
  },
}

export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.5,
  blur = 10,
  yOffset = 8,
  inView = false,
  inViewMargin = '-50px',
}: BlurFadeProps) {
  const prefersReducedMotion = useReducedMotion()
  // First paint (SSR + the matching hydration render) must be visible:
  // Framer Motion only reads `initial` on first commit. After the app has
  // hydrated, later mounts start from "hidden" so client navigations still
  // animate. Scroll-triggered (`inView`) content always starts hidden.
  // MotionHydrationSentinel owns flipping the flag — see above.
  //
  // Instances already mounted when the flag flips do re-render here, but
  // Framer only reads `initial` on the first commit, so nothing re-animates.
  const appHydrated = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>
  }

  const animateFromHidden = inView || appHydrated

  return (
    <motion.div
      className={cn(className)}
      initial={animateFromHidden ? 'hidden' : false}
      animate={inView ? undefined : 'visible'}
      whileInView={inView ? 'visible' : undefined}
      viewport={inView ? { once: true, margin: inViewMargin } : undefined}
      custom={{ blur, yOffset }}
      variants={variants}
      transition={{
        delay,
        duration,
        ease: EASE_OUT_SMOOTH,
      }}
    >
      {children}
    </motion.div>
  )
}
