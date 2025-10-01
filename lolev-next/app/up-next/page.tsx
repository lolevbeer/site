'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Beer } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface UpcomingBeer {
  type: string;
  variant: string;
  tempName: string;
  displayName: string;
}

export default function UpNextPage() {
  const [upcomingBeers, setUpcomingBeers] = useState<UpcomingBeer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpcomingBeers = async () => {
      try {
        const response = await fetch('/data/coming.csv');
        const text = await response.text();

        // Parse CSV
        const lines = text.split('\n');
        const beers: UpcomingBeer[] = [];

        // Skip header
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const [type, variant, tempName] = line.split(',');

            // Create display name from available data
            const displayName = type || tempName || variant || 'Mystery Beer';

            beers.push({
              type: type || '',
              variant: variant || '',
              tempName: tempName || '',
              displayName
            });
          }
        }

        setUpcomingBeers(beers);
      } catch (error) {
        console.error('Error loading upcoming beers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingBeers();
  }, []);

  // Check if beer has an image
  const getBeerImage = (variant: string) => {
    if (!variant) return null;
    return `/images/beer/${variant.toLowerCase()}.webp`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Up Next
        </h1>
        <p>
          Coming soon to our taps
        </p>
      </div>

      {/* Beer Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted" />
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : upcomingBeers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {upcomingBeers.map((beer, index) => (
            <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Beer Image or Placeholder */}
              <div className="relative h-48 w-full bg-gradient-to-b from-muted/10 to-background/50">
                {beer.variant ? (
                  <Image
                    src={getBeerImage(beer.variant) || ''}
                    alt={beer.displayName}
                    fill
                    className="object-contain p-4"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    onError={(e) => {
                      // Hide image if it fails to load
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center px-4">
                      <Beer className="h-16 w-16 text-muted-foreground/30 mx-auto mb-2" />
                      <div className="text-lg font-bold text-muted-foreground/30">
                        {beer.displayName}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-2">{beer.displayName}</h3>

                {beer.type && beer.type !== beer.displayName && (
                  <p className="text-sm text-muted-foreground mb-3">
                    Style: {beer.type}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Coming Soon</Badge>
                  {beer.variant && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/beer/${beer.variant.toLowerCase()}`}>
                        Learn More
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Beer className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-xl font-semibold mb-2">Check back soon!</p>
            <p className="text-muted-foreground">
              We're always brewing something new. Our upcoming beers will be announced here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Call to Action */}
      <div className="mt-12 text-center">
        <p className="text-muted-foreground mb-6">
          Want to be the first to know when these beers are available?
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild variant="outline">
            <Link href="/events">View Events</Link>
          </Button>
          <Button asChild>
            <Link href="/beer">Browse Current Beers</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}