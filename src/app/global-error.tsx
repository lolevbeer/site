'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Global error boundary for root-level errors.
 *
 * IMPORTANT: This component uses inline styles instead of Tailwind classes because:
 * - global-error.tsx completely replaces the HTML/body when rendering
 * - globals.css is imported in (frontend)/layout.tsx which won't run during root errors
 * - Inline styles guarantee the error page renders correctly regardless of CSS loading state
 */
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
      <body
        style={{
          backgroundColor: '#000000',
          color: '#f5f5f7',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
            <h1
              style={{
                fontSize: '1.875rem',
                fontWeight: 700,
                marginBottom: '1rem',
                lineHeight: 1.2,
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                color: '#98989d',
                marginBottom: '2rem',
                lineHeight: 1.6,
              }}
            >
              We encountered an unexpected error. Don&apos;t worry, your data is safe.
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: '#ffffff',
                color: '#000000',
                borderRadius: '0.375rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
