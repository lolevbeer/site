/**
 * BlurFade motion primitive.
 * Wraps children with a blur-to-sharp entrance animation using Framer Motion.
 */

'use client'

import { useEffect } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import { EASE_OUT_SMOOTH } from './constants'

/**
 * Module-scoped flag: has the client hydrated at least once? Read directly
 * (not React state) so a freshly-mounted BlurFade instance — including one
 * mounted well after the app's initial hydration, e.g. by client-side route
 * navigation — sees the up-to-date value on its very first render. Set once,
 * by the first BlurFade instance to commit on the client (see the `useEffect`
 * below); never reset in production. `__resetBlurFadeHydrationForTests` exists
 * only so tests can exercise both the pre- and post-hydration render paths.
 */
let hasAppHydrated = false

/** Test-only: reset the module-level hydration flag between test cases. */
export function __resetBlurFadeHydrationForTests() {
  hasAppHydrated = false
}

/**
 * Null-rendering client component that flips the module-level hydration flag
 * on the app's first client commit. Rendered once in the root layout so the
 * flag flips even when the first page has no BlurFade of its own (e.g.
 * /privacy, /terms, /beer-map) — without it, hard-loading such a page and
 * then client-navigating left the first destination un-animated. BlurFade's
 * own effect still sets the flag too, as belt-and-suspenders for trees
 * rendered outside the root layout.
 */
export function MotionHydrationSentinel() {
  useEffect(() => {
    hasAppHydrated = true
  }, [])
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
  // Server HTML — and the very first client render, before hydration
  // effects run — must paint at final, visible styles, or the page arrives
  // blank until React hydrates. Framer Motion only reads `initial` on a
  // component's *first commit*, and App Router mounts a brand-new
  // PageTransition/BlurFade tree on every client-side route change, so a
  // per-instance "have I mounted" flag doesn't work: each new tree starts
  // that flag at false again and would never animate. Instead
  // `hasAppHydrated` is a module-level flag shared by every instance,
  // flipped once — by the very first BlurFade to commit on the client —
  // and read directly (not via state) at render time:
  //   - Before that first hydration commit (server render, and the first
  //     client render prior to it): `initial={false}` — render straight at
  //     the "visible" target, no opacity:0/blur in the markup.
  //   - After hydration has happened at least once: `initial="hidden"` —
  //     so every later mount (client-side navigation swapping in a new
  //     tree) still animates in from hidden → visible.
  // `inView` (scroll-triggered) content is unaffected: it's meant to stay
  // hidden until scrolled into view, so it always keeps initial="hidden".
  useEffect(() => {
    hasAppHydrated = true
  }, [])

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>
  }

  return (
    <motion.div
      className={cn(className)}
      initial={inView || hasAppHydrated ? 'hidden' : false}
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
