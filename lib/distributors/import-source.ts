/** Encompass QuickLinks are the only supported network import source. */
export function isDistributorImportUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'encompass8.com' || url.hostname.endsWith('.encompass8.com'))
    )
  } catch {
    return false
  }
}

export const validateDistributorImportUrl = (value: unknown) =>
  !value || isDistributorImportUrl(value) || 'Use an HTTPS Encompass8 QuickLink URL.'
