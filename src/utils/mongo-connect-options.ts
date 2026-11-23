/**
 * MongoDB driver options for the Payload adapter.
 *
 * Serverless connection hardening: each Vercel instance opens its own Mongoose
 * pool, and the driver default is maxPoolSize 100. A post-deploy ISR
 * regeneration storm (many cold instances booting Payload at once) can then
 * spike past MongoDB's connection limit and surface as the transient fetch
 * errors that used to poison the route cache (see PR #144). Cap the pool small
 * and let idle sockets close so warm-but-quiet instances don't hold
 * connections open.
 * ponytail: maxPoolSize 10 is ample for this low-traffic site; raise it only if
 * a single instance ever needs more concurrent in-flight queries.
 *
 * Connection and server selection are bounded at 5s (the health probe applies
 * its own cancellable timeout to the native ping). On Vercel, reads and writes
 * are bounded too: the driver's default socket timeout is none, so a query on
 * a connection that stalls mid-flight (the Atlas network drops of Nov 17 and
 * 18, 2026) waits until Vercel kills the function, 60s for the
 * scheduled-publish cron. With a socket timeout it fails in 20s with a Mongo
 * error, and the next run retries. Migrations and local scripts keep no socket
 * timeout, since a long batch there is legitimate.
 */
export const MONGO_SOCKET_TIMEOUT_MS = 20_000

export function mongoConnectOptions({
  onVercel,
  migration,
}: {
  onVercel: boolean
  migration: boolean
}) {
  return {
    maxPoolSize: 10,
    maxIdleTimeMS: 10_000,
    connectTimeoutMS: 5_000,
    serverSelectionTimeoutMS: 5_000,
    ...(onVercel && !migration ? { socketTimeoutMS: MONGO_SOCKET_TIMEOUT_MS } : {}),
  }
}
