'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

function ErrorBoundaryPreview() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 border-2 border-dashed border-muted rounded-lg">
      <div className="text-center space-y-8">
        <div className="flex justify-center">
          <AlertCircle className="h-24 w-24 text-muted-foreground" />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold">Something went wrong</h1>
          <p className="text-lg text-muted-foreground">
            We encountered an unexpected error. Don't worry, your data is safe.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="default" size="lg">
            Try Again
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorThrower() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Test error from button click');
  }

  return (
    <Button onClick={() => setShouldThrow(true)} variant="default">
      Throw Real Error (close dev overlay to see error boundary)
    </Button>
  );
}

export default function TestErrorPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Error Boundary Preview</h1>
        <p className="text-muted-foreground mb-4">
          This is how the error boundary will look. In development, you'll need to close the error overlay to see it.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Preview (styled demo):</h2>
        <ErrorBoundaryPreview />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Test Real Error:</h2>
        <ErrorThrower />
      </div>
    </div>
  );
}
