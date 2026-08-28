/**
 * Fallback map coordinates used when a distributor address cannot be geocoded.
 *
 * Shared because the importers and the re-geocoding endpoint have to agree on
 * the exact values: `src/endpoints/import-distributors.ts` and
 * `src/endpoints/import-lake-beverage-csv.ts` write these coordinates when
 * geocoding fails, and `src/endpoints/regeocode-distributors.ts` finds those
 * records again by comparing stored coordinates against this same table. When
 * the copies drifted, a fallback written by one importer became invisible to
 * the repair pass.
 */

/**
 * Region code (as stored on `distributors.region`) to `[longitude, latitude]`.
 *
 * WV intentionally reuses the Pittsburgh point — the West Virginia accounts are
 * all in the Pittsburgh trade area.
 */
export const DEFAULT_REGION_COORDS: Record<string, [number, number]> = {
  PA: [-79.9959, 40.4406], // Pittsburgh
  OH: [-82.9988, 39.9612], // Columbus
  NY: [-77.6109, 43.1566], // Rochester area
  WV: [-79.9959, 40.4406], // Use Pittsburgh for WV too
}
