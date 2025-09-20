import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h2 className="text-3xl font-bold mb-4">Beer Not Found</h2>
      <p className="text-muted-foreground mb-8">
        Sorry, we couldn't find the beer you're looking for.
      </p>
      <Button asChild>
        <Link href="/beer">View All Beers</Link>
      </Button>
    </div>
  );
}