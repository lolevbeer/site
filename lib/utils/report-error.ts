/**
 * Error reporting that loads the Sentry SDK on demand.
 *
 * A static `import * as Sentry from '@sentry/nextjs'` in any client module
 * puts the whole browser SDK (~90 KB gzipped) in the shared bundle of every
 * public page, even though it is inert without a DSN. Reports are rare, so the
 * SDK is fetched the first time something is reported and skipped entirely when
 * no DSN is configured. Works on the server too (same SDK package, same DSN).
 * sentry-sdk.ts names the handful of SDK functions used, so the lazy chunk is
 * tree-shaken rather than the whole package.
 */

type Sdk = typeof import('./sentry-sdk')

const enabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)

const sdk = () => import('./sentry-sdk')

export function captureException(
  error: unknown,
  hint?: Parameters<Sdk['captureException']>[1],
): void {
  if (!enabled) return
  void sdk().then((Sentry) => Sentry.captureException(error, hint))
}

export function captureMessage(
  message: string,
  hint?: Parameters<Sdk['captureMessage']>[1],
): void {
  if (!enabled) return
  void sdk().then((Sentry) => Sentry.captureMessage(message, hint))
}
