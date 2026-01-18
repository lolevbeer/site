import * as Sentry from "@sentry/nextjs";

// Export for Next.js navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring - sample 20% of transactions in production
  tracesSampleRate: 0.2,

  // Browser profiling - sample 20% of profiled transactions for detailed performance data
  profilesSampleRate: 0.2,

  // Session replay for debugging user issues
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Enable logs
  enableLogs: true,

  // Capture console errors automatically
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["error"] }),
    Sentry.replayIntegration(),
    Sentry.browserProfilingIntegration(),
  ],

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",
});
