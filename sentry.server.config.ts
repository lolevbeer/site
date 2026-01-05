import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 1.0,

  // Enable logs
  enableLogs: true,

  // Capture console errors automatically
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["error"] }),
  ],

  // Don't send errors in development
  enabled: process.env.NODE_ENV === "production",
});
