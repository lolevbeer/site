/**
 * BlurFade motion primitive.
 * Wraps children with a blur-to-sharp entrance animation using Framer Motion.
 */

'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import { EASE_OUT_SMOOTH } from './constants'

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
  // Server HTML (and the very first client render, before hydration effects
  // run) must paint at final, visible styles — otherwise the page arrives
  // blank until React hydrates. `mounted` stays false through that first
  // paint, so `initial={false}` renders directly at the "visible"/animate
  // target with no opacity:0/blur in the markup. Once mounted flips true
  // (post-hydration), `initial="hidden"` is restored so this component's
  // *next* mount — e.g. client-side route navigation — still animates in.
  // `inView` (scroll-triggered) content is unaffected: it's meant to stay
  // hidden until scrolled into view, so it always keeps initial="hidden".
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>
  }

  return (
    <motion.div
      className={cn(className)}
      initial={inView || mounted ? 'hidden' : false}
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
