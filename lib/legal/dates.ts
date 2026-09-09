/**
 * Last meaningful edit for /privacy, /terms, and /accessibility.
 * Keep the sitemap lastmod in lockstep with the on-page date.
 */

export const LEGAL_PAGES_LASTMOD = '2026-09-09'

export function formatLegalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export const LEGAL_PAGES_LASTMOD_LABEL = formatLegalDate(LEGAL_PAGES_LASTMOD)
