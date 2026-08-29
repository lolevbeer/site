/**
 * Beer page availability filter vocabulary.
 *
 * Single source of truth for the `avail` URL param shared by the /beer page
 * and the homepage CTAs that deep-link into a pre-filtered view. Changing
 * DEFAULT_AVAILABILITY here keeps the nuqs default, the clear/active-filter
 * logic, and every CTA in agreement.
 */

export const AVAILABILITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'tap', label: 'On Draft' },
  { value: 'cans', label: 'In cans' },
] as const

export type Availability = (typeof AVAILABILITY_OPTIONS)[number]['value']

/** What a bare /beer visit shows; this value is never written to the URL. */
export const DEFAULT_AVAILABILITY: Availability = 'cans'

/** Link to /beer carrying an availability arrival context. */
export function beerHref(avail: Availability): string {
  return avail === DEFAULT_AVAILABILITY ? '/beer' : `/beer?avail=${avail}`
}
