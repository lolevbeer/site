import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry.options";

// Export for Next.js navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init(sentryOptions);
