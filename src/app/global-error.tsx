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
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#a1a1aa', marginBottom: '2rem' }}>
              We encountered an unexpected error. Don&apos;t worry, your data is safe.
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: '#fafafa',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
