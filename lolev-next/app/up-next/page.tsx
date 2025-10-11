'use client';

import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

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

        // Parse CSV with papaparse
        const parsed = Papa.parse(text, { header: true });
        const beers: UpcomingBeer[] = parsed.data
          .filter((row: any) => row.type || row.variant || row.tempName)
          .map((row: any) => {
            const displayName = row.type || row.tempName || row.variant;
            return {
              type: row.type || '',
              variant: row.variant || '',
              tempName: row.tempName || '',
              displayName
            };
          });

        setUpcomingBeers(beers);
      } catch (error) {
        console.error('Error loading upcoming beers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingBeers();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Up Next
        </h1>
      </div>

      {/* Beer List */}
      {loading ? (
        <div className="max-w-4xl mx-auto space-y-4 text-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse py-4">
              <div className="h-6 bg-muted rounded mb-2 mx-auto w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
            </div>
          ))}
        </div>
      ) : upcomingBeers.length > 0 ? (
        <div className="max-w-4xl mx-auto space-y-1 text-center">
          {upcomingBeers.map((beer, index) => (
            <div key={index} className="py-4">
              {beer.variant ? (
                <Button asChild variant="ghost" size="sm" className="text-lg font-semibold">
                  <Link href={`/beer/${beer.variant.toLowerCase()}`}>
                    {beer.displayName}
                  </Link>
                </Button>
              ) : (
                <h3 className="font-semibold text-lg">{beer.displayName}</h3>
              )}
              {beer.type && beer.type !== beer.displayName && (
                <p className="text-sm text-muted-foreground">{beer.type}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl font-semibold mb-2">Check back soon!</p>
          <p className="text-muted-foreground">
            We're always brewing something new. Our upcoming beers will be announced here.
          </p>
        </div>
      )}

      {/* Call to Action */}
      <div className="mt-12 text-center">
        <Button asChild>
          <Link href="/beer">Browse beer</Link>
        </Button>
      </div>
    </div>
  );
}