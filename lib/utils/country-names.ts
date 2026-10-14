/**
 * English country names for address text, from ISO-3166-1 alpha-2 codes. A blank or
 * `US` country adds nothing, so US addresses read as they always have.
 */

const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })

/** English country name for a code, e.g. `NL` becomes `Netherlands`; the code if unknown. */
export function countryName(code: string): string {
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

/** The country name to append to an address, or `''` for a blank or US country. */
export function countrySuffix(country?: string | null): string {
  return country && country !== 'US' ? countryName(country) : ''
}
