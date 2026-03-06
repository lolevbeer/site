/**
 * PageTransition wrapper for route-level blur-to-sharp entrance.
 * Delegates to BlurFade with page-appropriate defaults.
 */

'use client';

import { BlurFade } from './blur-fade';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <BlurFade blur={8} duration={0.4} yOffset={0}>
      {children}
    </BlurFade>
  );
}
