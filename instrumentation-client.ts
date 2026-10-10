import * as Sentry from "@sentry/nextjs";

// Export for Next.js navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Errors and traces only. Replay and profiling are left out on purpose: they
// add rrweb/profiler code to every page (~178KB gz measured on the live
// chunk before removal).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring - sample 20% of transactions in production
  tracesSampleRate: 0.2,

  // Only send errors in production, and only when a DSN is configured
  enabled: process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
