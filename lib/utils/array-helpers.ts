/**
 * Generic array utility functions
 */

/**
 * Converts parallel arrays of location slugs and results into a location-keyed map
 *
 * @example
 * const slugs = ['lawrenceville', 'zelienople'];
 * const menus = [menu1, menu2];
 * const menusByLocation = arrayToLocationMap(slugs, menus);
 * // Result: { lawrenceville: menu1, zelienople: menu2 }
 */
export function arrayToLocationMap<T>(
  locationSlugs: string[],
  results: T[]
): Record<string, T> {
  return Object.fromEntries(
    locationSlugs.map((slug, i) => [slug, results[i]])
  );
}
