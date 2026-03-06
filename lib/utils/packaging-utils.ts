/**
 * Determines the packaging type label for a beer based on its pricing fields.
 * Beers on "cans" menus may actually be bottled — use pricing to distinguish.
 */
import type { Beer as PayloadBeer } from '@/src/payload-types';

export type PackagingType = 'cans' | 'bottles' | 'cans_and_bottles';

/**
 * Determine packaging type from beer pricing fields.
 * - fourPack set → cans
 * - bottlePrice set → bottles
 * - both set → cans_and_bottles
 * Falls back to 'cans' if neither is set (legacy behavior).
 */
export function getPackagingType(beer: Pick<PayloadBeer, 'fourPack' | 'bottlePrice'>): PackagingType {
  const hasCans = typeof beer.fourPack === 'number' && beer.fourPack > 0;
  const hasBottles = typeof beer.bottlePrice === 'number' && beer.bottlePrice > 0;

  if (hasCans && hasBottles) return 'cans_and_bottles';
  if (hasBottles) return 'bottles';
  return 'cans';
}

/**
 * Get the user-facing "available" badge label for a beer's packaging.
 */
export function getPackagingLabel(type: PackagingType): string {
  switch (type) {
    case 'bottles':
      return 'Bottles Available';
    case 'cans_and_bottles':
      return 'Cans & Bottles Available';
    case 'cans':
    default:
      return 'Cans Available';
  }
}

/**
 * Get the "not available" label when a beer is draft-only.
 */
export function getNoPackagingLabel(type: PackagingType): string {
  switch (type) {
    case 'bottles':
      return 'No Bottles';
    case 'cans_and_bottles':
      return 'No Cans or Bottles';
    case 'cans':
    default:
      return 'No Cans';
  }
}

/**
 * Get the draft-only availability message.
 */
export function getDraftOnlyMessage(type: PackagingType): string {
  switch (type) {
    case 'bottles':
      return 'No bottles available at this time — draft only';
    case 'cans_and_bottles':
      return 'No cans or bottles available at this time — draft only';
    case 'cans':
    default:
      return 'No cans available at this time — draft only';
  }
}

/**
 * Get the location availability message (e.g., "Cans available at X").
 */
export function getPackagingAtLocationsMessage(type: PackagingType, locations: string[]): string {
  const locationStr = locations.join(' and ');
  switch (type) {
    case 'bottles':
      return `Bottles available at ${locationStr}`;
    case 'cans_and_bottles':
      return `Cans & bottles available at ${locationStr}`;
    case 'cans':
    default:
      return `Cans available at ${locationStr}`;
  }
}
