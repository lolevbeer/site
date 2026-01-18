import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import type { Beer, Style } from '@/src/payload-types';

interface ComingSoonBeer {
  beer?: (string | Beer) | null;
  style?: (string | Style) | null;
}

interface UpcomingBeersProps {
  comingSoonBeers?: ComingSoonBeer[];
}

/** Extract beer object if populated, null otherwise */
function extractBeer(item: ComingSoonBeer): Beer | null {
  return typeof item.beer === 'object' ? item.beer : null;
}

/** Extract style object if populated, null otherwise */
function extractStyle(item: ComingSoonBeer): Style | null {
  return typeof item.style === 'object' ? item.style : null;
}

export function UpcomingBeers({ comingSoonBeers = [] }: UpcomingBeersProps): React.ReactElement | null {
  // Filter and normalize items with valid beer or style data
  const validItems = comingSoonBeers
    .map(item => ({
      beer: extractBeer(item),
      style: extractStyle(item),
    }))
    .filter(({ beer, style }) => beer?.slug || style);

  if (validItems.length === 0) {
    return null;
  }

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeader
            title="Up Next"
            adminUrl="/admin/globals/coming-soon"
          />
        </ScrollReveal>

        <div className="max-w-4xl mx-auto space-y-1 text-center mb-8">
          {validItems.map(({ beer, style }, index) => (
            <div key={index}>
              {beer?.slug ? (
                <Button asChild variant="ghost" size="sm" className="text-lg font-semibold h-auto py-0 px-2">
                  <Link href={`/beer/${beer.slug}`}>{beer.name}</Link>
                </Button>
              ) : (
                <h3 className="font-semibold text-lg">{style?.name}</h3>
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/beer">View All Beer</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
