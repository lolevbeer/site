/**
 * Determines the packaging type label for a beer based on its pricing fields.
 * Beers on "cans" menus may actually be bottled — use pricing to distinguish.
 */
import type { Beer as PayloadBeer } from '@/src/payload-types'
import { formatPrice } from '@/lib/utils/formatters'

export type PackagingType = 'cans' | 'bottles' | 'cans_and_bottles'

/** A price field counts only when it is a positive number; 0 or unset means "not sold this way". */
export function isSold(price: number | null | undefined): price is number {
  return typeof price === 'number' && price > 0
}

/**
 * Determine packaging type from beer pricing fields.
 * - fourPack set → cans
 * - bottlePrice set → bottles
 * - both set → cans_and_bottles
 * Falls back to 'cans' if neither is set (legacy behavior).
 */
export function getPackagingType(
  beer: Pick<PayloadBeer, 'fourPack' | 'bottlePrice'>,
): PackagingType {
  const hasCans = isSold(beer.fourPack)
  const hasBottles = isSold(beer.bottlePrice)

  if (hasCans && hasBottles) return 'cans_and_bottles'
  if (hasBottles) return 'bottles'
  return 'cans'
}

/**
 * Get the user-facing "available" badge label for a beer's packaging.
 */
export function getPackagingLabel(type: PackagingType): string {
  switch (type) {
    case 'bottles':
      return 'Bottles Available'
    case 'cans_and_bottles':
      return 'Cans & Bottles Available'
    case 'cans':
    default:
      return 'Cans Available'
  }
}

/**
 * Get the "not available" label when a beer is draft-only.
 */
export function getNoPackagingLabel(type: PackagingType): string {
  switch (type) {
    case 'bottles':
      return 'No Bottles'
    case 'cans_and_bottles':
      return 'No Cans or Bottles'
    case 'cans':
    default:
      return 'No Cans'
  }
}

/**
 * Get the draft-only availability message.
 */
export function getDraftOnlyMessage(type: PackagingType): string {
  switch (type) {
    case 'bottles':
      return 'No bottles available at this time — draft only'
    case 'cans_and_bottles':
      return 'No cans or bottles available at this time — draft only'
    case 'cans':
    default:
      return 'No cans available at this time — draft only'
  }
}

/**
 * Get the location availability message (e.g., "Cans available at X").
 */
export function getPackagingAtLocationsMessage(type: PackagingType, locations: string[]): string {
  const locationStr = locations.join(' and ')
  switch (type) {
    case 'bottles':
      return `Bottles available at ${locationStr}`
    case 'cans_and_bottles':
      return `Cans & bottles available at ${locationStr}`
    case 'cans':
    default:
      return `Cans available at ${locationStr}`
  }
}

/**
 * Price lines for the beer detail page ("Draft $7", "4 Pack $15", ...): draft
 * only when the beer is on tap somewhere, packaged prices only when it is on a
 * cans menu, and never a price that isn't sold (0 or unset).
 */
export function getPricingLines(
  beer: Pick<PayloadBeer, 'draftPrice' | 'fourPack' | 'bottlePrice'>,
  { onTap, inCans }: { onTap: boolean; inCans: boolean },
): string[] {
  const lines: string[] = []
  if (onTap && isSold(beer.draftPrice)) lines.push(`Draft ${formatPrice(beer.draftPrice)}`)
  if (inCans && isSold(beer.fourPack)) lines.push(`4 Pack ${formatPrice(beer.fourPack)}`)
  if (inCans && isSold(beer.bottlePrice)) lines.push(`Bottle ${formatPrice(beer.bottlePrice)}`)
  return lines
}
