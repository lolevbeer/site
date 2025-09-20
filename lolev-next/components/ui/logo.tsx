import React from 'react';
import { cn } from '@/lib/utils';
import { LogoSVG } from './logo-svg';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function Logo({
  className,
  width = 48,
  height = 52,
}: LogoProps) {
  return (
    <div className={cn("inline-flex items-center justify-center", className)}>
      <LogoSVG width={width} height={height} />
    </div>
  );
}

export function LogoWithText({
  className,
  logoWidth = 32,
  logoHeight = 35,
  textClassName,
}: LogoProps & { textClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Logo width={logoWidth} height={logoHeight} />
      <span className={cn("font-bold text-xl", textClassName)}>Lolev Beer</span>
    </div>
  );
}