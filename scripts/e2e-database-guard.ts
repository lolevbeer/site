/** Guards the release-smoke seed from writing to non-disposable MongoDB databases. */
/** Loopback hosts are always disposable; remote targets need explicit opt-in. */
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

  if (isLoopbackHost(database.hostname)) {
    return true
  }

  return explicit === '1' && /-(?:e2e|ci)$/.test(database.pathname)
}
