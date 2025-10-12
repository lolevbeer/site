/**
 * Beer Icon Utilities
 * Shared utilities for beer-related icons
 */

import React from 'react';
import { PintIcon, SteinIcon, TekuIcon } from '@/components/icons';
import { GlassType } from '@/lib/types/beer';

/**
 * Get the appropriate glass icon component based on glass type
 */
export function getGlassIcon(glass?: GlassType | string): React.ComponentType<{ className?: string }> {
  const glassType = typeof glass === 'string' ? glass.toLowerCase() : glass;

  switch (glassType) {
    case GlassType.PINT:
    case 'pint':
      return PintIcon;
    case GlassType.TEKU:
    case 'teku':
      return TekuIcon;
    case GlassType.STEIN:
    case 'stein':
      return SteinIcon;
    default:
      return PintIcon;
  }
}
