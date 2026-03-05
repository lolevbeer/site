'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground font-sans">
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold mb-4">
              Something went wrong
            </h1>
            <p className="text-muted-foreground mb-8">
              We encountered an unexpected error. Don&apos;t worry, your data is safe.
            </p>
            <button
              onClick={reset}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
