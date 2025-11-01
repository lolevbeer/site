import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
          <p className="text-muted-foreground">
            Sorry, we couldn't find the page you're looking for.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/">
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/beer">
              View Beer Menu
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
