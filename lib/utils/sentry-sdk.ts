/**
 * The slice of @sentry/nextjs the client uses, re-exported so the lazy
 * `import('./sentry-sdk')` in report-error.ts and instrumentation-client.ts
 * pulls one tree-shaken chunk. A dynamic `import('@sentry/nextjs')` keeps the
 * whole namespace, replay and all (~600 KB); this keeps what is named here.
 * This is the only client-reachable file allowed to import the package.
 */
export { captureException, captureMessage, captureRouterTransitionStart, init } from '@sentry/nextjs'
