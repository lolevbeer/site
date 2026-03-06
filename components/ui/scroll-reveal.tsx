/**
 * ScrollReveal component.
 * Thin wrapper around BlurFade that triggers on viewport entry.
 */

'use client';

import { BlurFade } from '@/components/motion';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  return (
    <BlurFade className={className} delay={delay} inView>
      {children}
    </BlurFade>
  );
}
