import type { captureRouterTransitionStart } from './lib/utils/sentry-sdk'
import { sentryOptions } from './sentry.options'

/**
 * Loads the Sentry browser SDK only when it is enabled (production with a DSN),
 * and as its own chunk rather than in the shared bundle every page ships.
 * Trade-off: an error thrown before that chunk arrives is not reported.
 * Everything that reports goes through lib/utils/report-error.ts for the
 * same reason, and both import the SDK via lib/utils/sentry-sdk.ts so the
 * lazy chunk holds only the functions used.
 */
let sentry: typeof import('./lib/utils/sentry-sdk') | undefined

if (sentryOptions.enabled) {
  void import('./lib/utils/sentry-sdk').then((Sentry) => {
    Sentry.init(sentryOptions)
    sentry = Sentry
  })
}

// Next.js navigation instrumentation; a no-op until the SDK has loaded.
export const onRouterTransitionStart: typeof captureRouterTransitionStart = (...args) =>
  sentry?.captureRouterTransitionStart(...args)
