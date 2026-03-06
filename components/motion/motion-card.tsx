/**
 * MotionCard primitive.
 * Adds spring-based hover lift, press feedback, and optional glow border.
 */

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 20,
};

export function MotionCard({
  children,
  className,
  glow = false,
}: MotionCardProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div
        className={cn(
          glow && 'dark:hover:shadow-[0_0_20px_rgba(255,149,0,0.08)] dark:hover:border-amber-500/10',
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        'will-change-transform',
        glow && 'dark:hover:shadow-[0_0_20px_rgba(255,149,0,0.08)] dark:hover:border-amber-500/10',
        className,
      )}
      whileHover={{ y: -4, transition: springTransition }}
      whileTap={{ scale: 0.98, transition: springTransition }}
    >
      {children}
    </motion.div>
  );
}
