import React from 'react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import Link from 'next/link';
import type { Beer, Style } from '@/src/payload-types';

interface ComingSoonBeer {
  beer?: (string | Beer) | null;
  style?: (string | Style) | null;
}

interface UpcomingBeersProps {
  comingSoonBeers?: ComingSoonBeer[];
  isAuthenticated?: boolean;
}

export function UpcomingBeers({ comingSoonBeers, isAuthenticated }: UpcomingBeersProps) {
  // Filter to only items with valid beer or style data
  const validItems = (comingSoonBeers || []).filter(item => {
    const beer = typeof item.beer === 'object' ? item.beer : null;
    const style = typeof item.style === 'object' ? item.style : null;
    return (beer && beer.slug) || style;
  });

  // Don't show section if no valid upcoming beers
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
            isAuthenticated={isAuthenticated}
          />
        </ScrollReveal>

        <div className="max-w-4xl mx-auto space-y-1 text-center mb-8">
          {validItems.map((item, index) => {
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

            // Style is selected, show style name without link
            return (
              <div key={index}>
                <h3 className="font-semibold text-lg">{style!.name}</h3>
              </div>
            );
          })}
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
