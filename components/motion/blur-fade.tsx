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
 * True after the first client commit of any BlurFade or MotionHydrationSentinel.
 * Module-scoped (not React state) so a BlurFade mounted later — e.g. App Router
 * swapping in a new tree on navigation — sees the value on its first render.
 * A per-instance flag would stay false on every new tree and skip the entrance
 * animation. Never reset in production.
 */
let hasAppHydrated = false

function markAppHydrated() {
  hasAppHydrated = true
}

/** Test-only: reset the hydration flag between cases. */
export function __resetBlurFadeHydrationForTests() {
  hasAppHydrated = false
}

/**
 * Flips `hasAppHydrated` on the app's first client commit. Rendered in the
 * root layout so pages with no BlurFade of their own (/privacy, /terms,
 * /beer-map) still mark hydration; otherwise the first client navigation
 * would not animate. BlurFade also sets the flag, for trees outside the
 * root layout.
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
  useEffect(markAppHydrated, [])

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>
  }

  const animateFromHidden = inView || hasAppHydrated

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
