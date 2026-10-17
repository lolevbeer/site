/** Guards the release-smoke seed from writing to non-disposable MongoDB databases. */
/** A local host can still hold real data: every target needs explicit opt-in and a test name. */
export function isLoopbackHost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
}

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

  return explicit === '1' && /-(?:e2e|ci)$/.test(database.pathname)
}
