/** Only the distributors' approved Encompass QuickLink hosts may be fetched. */
export function isDistributorImportUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'encompass8.com' ||
        url.hostname.endsWith('.encompass8.com') ||
        url.hostname === 'sarenecraftdist.com')
    )
  } catch {
    return false
  }
}

export const validateDistributorImportUrl = (value: unknown) =>
  !value ||
  isDistributorImportUrl(value) ||
  'Use an HTTPS QuickLink URL from Encompass8 or sarenecraftdist.com.'
