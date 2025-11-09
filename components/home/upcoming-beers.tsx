import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Beer, Style } from '@/src/payload-types';

interface ComingSoonBeer {
  beer?: (string | Beer) | null;
  style?: (string | Style) | null;
}

interface UpcomingBeersProps {
  comingSoonBeers?: ComingSoonBeer[];
}

export function UpcomingBeers({ comingSoonBeers }: UpcomingBeersProps) {
  // Don't show section if no upcoming beers
  if (!comingSoonBeers || comingSoonBeers.length === 0) {
    return null;
  }

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Up Next
          </h2>
        </div>

        <div className="max-w-4xl mx-auto space-y-1 text-center mb-8">
          {comingSoonBeers.map((item, index) => {
            const beer = typeof item.beer === 'object' ? item.beer : null;
            const style = typeof item.style === 'object' ? item.style : null;

            // If beer is selected, show beer name and link (no style display)
            if (beer && beer.slug) {
              return (
                <div key={index}>
                  <Button asChild variant="ghost" size="sm" className="text-lg font-semibold h-auto py-0 px-2">
                    <Link href={`/beer/${beer.slug}`}>
                      {beer.name}
                    </Link>
                  </Button>
                </div>
              );
            }

            // If only style is selected, show style name without link
            if (style) {
              return (
                <div key={index}>
                  <h3 className="font-semibold text-lg">{style.name}</h3>
                </div>
              );
            }

            return null;
          })}
        </div>

        <div className="text-center">
          <Button asChild variant="default" size="lg">
            <Link href="/beer">View All Beer</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
