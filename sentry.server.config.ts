import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring - sample 20% of transactions in production
  tracesSampleRate: 0.2,

  // Server profiling - sample 20% of profiled transactions
  profilesSampleRate: 0.2,

  // Enable logs
  enableLogs: true,

  // Capture console errors automatically
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["error"] }),
  ],

  // Don't send errors in development
  enabled: process.env.NODE_ENV === "production",
});
