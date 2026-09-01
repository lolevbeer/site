/** Guards the release-smoke seed from writing to non-disposable MongoDB databases. */
export function isDisposableDatabase(uri: string, explicit: string | undefined): boolean {
  let database: URL

  try {
    database = new URL(uri)
  } catch {
    return false
  }

  if (database.protocol !== 'mongodb:' && database.protocol !== 'mongodb+srv:') {
    return false
  }

  if (['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) {
    return true
  }

  return explicit === '1' && /-(?:e2e|ci)$/.test(database.pathname)
}
