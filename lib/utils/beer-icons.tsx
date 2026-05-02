/**
 * Beer Icon Utilities
 * Shared utilities for beer-related icons
 */

import React from 'react';
import { PintIcon, SteinIcon, TekuIcon, UhaIcon } from '@/components/icons';
import { GlassType } from '@/lib/types/beer';

type GlassIcon = React.ComponentType<{ className?: string }>;

const GLASS_ICONS: Record<GlassType, GlassIcon> = {
  [GlassType.PINT]: PintIcon,
  [GlassType.TEKU]: TekuIcon,
  [GlassType.STEIN]: SteinIcon,
  [GlassType.UHA]: UhaIcon,
};

export function getGlassIcon(glass?: GlassType | string): GlassIcon {
  const key = typeof glass === 'string' ? (glass.toLowerCase() as GlassType) : glass;
  return (key && GLASS_ICONS[key]) ?? PintIcon;
}
