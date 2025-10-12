'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
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
          <Button onClick={reset} variant="default" size="lg">
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
