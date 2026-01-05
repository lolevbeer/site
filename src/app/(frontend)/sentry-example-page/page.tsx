'use client';

import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

export default function SentryExamplePage() {
  const throwClientError = () => {
    // @ts-expect-error - intentional error for Sentry testing
    myUndefinedFunction();
  };

  const captureManualError = () => {
    Sentry.captureException(new Error('Sentry Manual Capture Test'));
    alert('Error sent to Sentry!');
  };

  const triggerServerError = async () => {
    await fetch('/api/sentry-example-api');
  };

  return (
    <div className="container mx-auto py-16 px-4 text-center space-y-8">
      <h1 className="text-3xl font-bold">Sentry Test Page</h1>
      <p className="text-muted-foreground">
        Use these buttons to test that Sentry is capturing errors correctly.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button onClick={throwClientError} variant="destructive">
          Throw Client Error
        </Button>
        <Button onClick={captureManualError} variant="outline">
          Capture Manual Error
        </Button>
        <Button onClick={triggerServerError} variant="secondary">
          Trigger Server Error
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Check your Sentry dashboard at{' '}
        <a
          href="https://lolev-beer.sentry.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          lolev-beer.sentry.io
        </a>
      </p>
    </div>
  );
}
