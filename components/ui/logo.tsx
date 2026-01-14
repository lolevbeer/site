import React from 'react';
import { cn } from '@/lib/utils';
import { LogoSVG } from './logo-svg';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function Logo({
  className = "",
  width = 48,
  height = 52,
}: LogoProps) {
  return (
    <div className={cn("inline-flex items-center justify-center", className)}>
      <LogoSVG width={width} height={height} />
    </div>
  );
}

interface LogoWithTextProps {
  className?: string;
  logoWidth?: number;
  logoHeight?: number;
  textClassName?: string;
  priority?: boolean;
  collapsed?: boolean;
}

export function LogoWithText({
  className = "",
  logoWidth = 32,
  logoHeight = 35,
  textClassName = "",
  collapsed = false,
}: LogoWithTextProps) {
  return (
    <div className={cn("flex items-center gap-2 overflow-hidden", className)} style={{ perspective: '500px' }}>
      <Logo width={logoWidth} height={logoHeight} className="flex-shrink-0" />
      <span
        className={cn(
          "font-bold text-xl text-foreground whitespace-nowrap transition-all duration-300 ease-out origin-left",
          textClassName
        )}
        style={{
          transform: collapsed
            ? 'rotateY(-90deg) translateX(-8px) scale(0.8)'
            : 'rotateY(0deg) translateX(0) scale(1)',
          opacity: collapsed ? 0 : 1,
          maxWidth: collapsed ? 0 : '120px',
        }}
      >
        Lolev Beer
      </span>
    </div>
  );
}