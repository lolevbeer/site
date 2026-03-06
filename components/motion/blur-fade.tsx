/**
 * BlurFade motion primitive.
 * Wraps children with a blur-to-sharp entrance animation using Framer Motion.
 */

'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  blur?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: string;
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
};

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
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate={inView ? undefined : 'visible'}
      whileInView={inView ? 'visible' : undefined}
      viewport={inView ? { once: true, margin: inViewMargin } : undefined}
      custom={{ blur, yOffset }}
      variants={variants}
      transition={{
        delay,
        duration,
        ease: [0.25, 0.4, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
