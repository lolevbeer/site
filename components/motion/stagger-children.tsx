/**
 * StaggerChildren wrapper for cascading entrance animations.
 */

'use client';

import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { EASE_OUT_SMOOTH } from './constants';

interface StaggerChildrenProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  inView?: boolean;
}

const containerVariants = {
  hidden: {},
  visible: (staggerDelay: number) => ({
    transition: {
      staggerChildren: staggerDelay,
    },
  }),
};

const itemVariants = {
  hidden: {
    opacity: 0,
    filter: 'blur(10px)',
    y: 8,
    scale: 1.02,
  },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: EASE_OUT_SMOOTH,
    },
  },
};

export function StaggerChildren({
  children,
  className,
  staggerDelay = 0.06,
  inView = false,
}: StaggerChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  // When inView, wait for viewport intersection; otherwise animate immediately
  const animateState = inView && !isInView ? 'hidden' : 'visible';

  return (
    <motion.div
      ref={inView ? ref : undefined}
      className={cn(className)}
      initial="hidden"
      animate={animateState}
      custom={staggerDelay}
      variants={containerVariants}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <motion.div className={cn(className)} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
