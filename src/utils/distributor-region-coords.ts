/**
 * Fallback map coordinates used when a distributor address cannot be geocoded.
 *
 * Shared because the importer and the re-geocoding endpoint have to agree on
 * the exact values: `src/endpoints/import-distributors.ts` writes these
 * coordinates when geocoding fails, and `src/endpoints/regeocode-distributors.ts`
 * finds those records again by comparing stored coordinates against this same
 * table. NY is no longer written (the Lake Beverage importer is gone) but stays
 * so NY records it parked on the fallback point can still be repaired. The CSV
 * importer never writes a fallback; it reports ungeocodable rows instead.
 */

/**
 * Region code (as stored on `distributors.region`) to `[longitude, latitude]`.
 *
 * WV intentionally reuses the Pittsburgh point — the West Virginia accounts are
 * all in the Pittsburgh trade area.
 */
import type { StateCode } from '@/lib/distributors/fields'

export const DEFAULT_REGION_COORDS = {
  PA: [-79.9959, 40.4406], // Pittsburgh
  OH: [-82.9988, 39.9612], // Columbus
  NY: [-77.6109, 43.1566], // Rochester area
  WV: [-79.9959, 40.4406], // Use Pittsburgh for WV too
} satisfies Partial<Record<StateCode, [number, number]>>
