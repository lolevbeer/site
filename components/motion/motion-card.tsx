/**
 * MotionCard primitive.
 * Adds spring-based hover lift and press feedback.
 */

'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MotionCardProps {
  children: React.ReactNode
  className?: string
}

const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 20,
}

export function MotionCard({ children, className }: MotionCardProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={cn('will-change-transform', className)}
      whileHover={{ y: -4, transition: springTransition }}
      whileTap={{ scale: 0.98, transition: springTransition }}
    >
      {children}
    </motion.div>
  )
}
