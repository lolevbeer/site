'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  speed?: number;
}

const Marquee = React.forwardRef<HTMLDivElement, MarqueeProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative flex overflow-hidden", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Marquee.displayName = 'Marquee';

interface MarqueeContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  pauseOnHover?: boolean;
  speed?: number;
}

const MarqueeContent = React.forwardRef<HTMLDivElement, MarqueeContentProps>(
  ({ className, children, pauseOnHover = false, speed = 30, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex animate-marquee items-center gap-4",
          pauseOnHover && "hover:[animation-play-state:paused]",
          className
        )}
        style={{
          animationDuration: `${speed}s`,
        }}
        {...props}
      >
        {children}
        {children}
      </div>
    );
  }
);
MarqueeContent.displayName = 'MarqueeContent';

interface MarqueeItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const MarqueeItem = React.forwardRef<HTMLDivElement, MarqueeItemProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex-shrink-0", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MarqueeItem.displayName = 'MarqueeItem';

interface MarqueeFadeProps extends React.HTMLAttributes<HTMLDivElement> {
  side: 'left' | 'right';
}

const MarqueeFade = React.forwardRef<HTMLDivElement, MarqueeFadeProps>(
  ({ className, side, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "absolute top-0 z-10 h-full w-32 pointer-events-none",
          side === 'left' && "left-0 bg-gradient-to-r",
          side === 'right' && "right-0 bg-gradient-to-l",
          className
        )}
        {...props}
      />
    );
  }
);
MarqueeFade.displayName = 'MarqueeFade';

export { Marquee, MarqueeContent, MarqueeItem, MarqueeFade };