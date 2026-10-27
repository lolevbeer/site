/**
 * Sentry options shared by the client, server, and edge configs.
 * Errors and sampled traces only. Replay and profiling are left out on purpose:
 * they add rrweb/profiler code to every page (~178KB gz measured on the live
 * chunk before removal). On the client the SDK is loaded lazily and only when
 * `enabled` is true (instrumentation-client.ts, lib/utils/report-error.ts).
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring - sample 20% of transactions in production
  tracesSampleRate: 0.2,

  // Only send events in production, and only when a DSN is configured
  enabled: process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_SENTRY_DSN,
}
