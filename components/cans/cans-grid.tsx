'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Papa from 'papaparse';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocationContext } from '@/components/location/location-provider';
import { getGlassIcon } from '@/lib/utils/beer-icons';

interface CanBeer {
  variant: string;
  name: string;
  type: string;
  abv: string;
  fourPackPrice: string;
  image: boolean;
  onDraft: boolean;
  glass?: string;
}

interface CansGridProps {
  maxItems?: number;
}

export function CansGrid({ maxItems }: CansGridProps) {
  const { currentLocation } = useLocationContext();
  const [cans, setCans] = useState<CanBeer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCans = async () => {
      try {
        const [lawrencevilleCansRes, zelienopleCansRes, lawrencevilleDraftRes, zelienopleDraftRes, beerRes] = await Promise.all([
          fetch('/data/lawrenceville-cans.csv'),
          fetch('/data/zelienople-cans.csv'),
          fetch('/data/lawrenceville-draft.csv'),
          fetch('/data/zelienople-draft.csv'),
          fetch('/data/beer.csv')
        ]);

        const [lawrencevilleCansText, zelienopleCansText, lawrencevilleDraftText, zelienopleDraftText, beerText] = await Promise.all([
          lawrencevilleCansRes.text(),
          zelienopleCansRes.text(),
          lawrencevilleDraftRes.text(),
          zelienopleDraftRes.text(),
          beerRes.text()
        ]);

        // Parse draft CSVs to track which beers are on draft
        const lawrencevilleDraftData = Papa.parse(lawrencevilleDraftText, { header: true });
        const zelienopleDraftData = Papa.parse(zelienopleDraftText, { header: true });

        const onDraftSet = new Set<string>();
        lawrencevilleDraftData.data.forEach((row: any) => {
          if (row.variant) onDraftSet.add(row.variant.toLowerCase());
        });
        zelienopleDraftData.data.forEach((row: any) => {
          if (row.variant) onDraftSet.add(row.variant.toLowerCase());
        });

        // Parse beer.csv
        const beerData = Papa.parse(beerText, { header: true });
        const beerMap = new Map();
        beerData.data.forEach((row: any) => {
          if (row.variant) {
            beerMap.set(row.variant.toLowerCase(), {
              variant: row.variant,
              name: row.name,
              type: row.type,
              abv: row.abv,
              image: row.image === 'TRUE',
              glass: row.glass
            });
          }
        });

        // Parse Lawrenceville cans
        const lawrencevilleCansData = Papa.parse(lawrencevilleCansText, { header: true });
        const lawrencevilleCans: CanBeer[] = lawrencevilleCansData.data
          .filter((row: any) => row.variant)
          .map((row: any) => {
            const beerInfo = beerMap.get(row.variant.toLowerCase());
            if (beerInfo) {
              return {
                ...beerInfo,
                fourPackPrice: row.fourPack ? `$${row.fourPack}` : '',
                onDraft: onDraftSet.has(row.variant.toLowerCase())
              };
            }
            return null;
          })
          .filter(Boolean) as CanBeer[];

        // Parse Zelienople cans
        const zelienopleCansData = Papa.parse(zelienopleCansText, { header: true });
        const zelienopleCans: CanBeer[] = zelienopleCansData.data
          .filter((row: any) => row.variant)
          .map((row: any) => {
            const beerInfo = beerMap.get(row.variant.toLowerCase());
            if (beerInfo) {
              return {
                ...beerInfo,
                fourPackPrice: row.fourPack ? `$${row.fourPack}` : '',
                onDraft: onDraftSet.has(row.variant.toLowerCase())
              };
            }
            return null;
          })
          .filter(Boolean) as CanBeer[];

        // Set cans based on location
        const selectedCans = currentLocation === 'lawrenceville'
          ? lawrencevilleCans
          : currentLocation === 'zelienople'
          ? zelienopleCans
          : [...lawrencevilleCans, ...zelienopleCans];

        setCans(maxItems ? selectedCans.slice(0, maxItems) : selectedCans);
      } catch (error) {
        console.error('Error loading cans:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCans();
  }, [currentLocation, maxItems]);

  return (
    <>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: maxItems || 8 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border shadow-sm animate-pulse h-96" />
          ))}
        </div>
      ) : cans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" suppressHydrationWarning>
          {cans.map((beer, index) => (
            <Link key={`${beer.variant}-${index}`} href={`/beer/${beer.variant.toLowerCase()}`} className="group">
              <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col border-0 h-full cursor-pointer bg-[var(--color-card-interactive)]">
                <div className={`relative h-48 w-full flex-shrink-0 ${beer.image ? 'bg-gradient-to-b from-muted/5 to-background/20' : ''}`}>
                  {beer.image ? (
                    <Image
                      src={`/images/beer/${beer.variant.toLowerCase()}.webp`}
                      alt={beer.name}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      onError={(e) => {
                        e.currentTarget.parentElement!.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center px-4">
                        <div className="text-2xl font-bold text-muted-foreground/30 mb-2">
                          {beer.name}
                        </div>
                        <div className="text-sm text-muted-foreground/30">
                          {beer.type}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <CardContent className="p-4 flex flex-col flex-grow">
                  <div className="flex-grow">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold">{beer.name}</h3>
                      {beer.onDraft && (() => {
                        const GlassIcon = getGlassIcon(beer.glass);
                        return (
                          <Badge variant="default" className="text-xs flex-shrink-0 flex items-center gap-1">
                            <GlassIcon className="h-3 w-3" />
                            Pouring
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {beer.type}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {beer.fourPackPrice && (
                        <div className="font-semibold text-foreground mt-2">
                          4 Pack {beer.fourPackPrice}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button variant="ghost" size="sm" className="w-full pointer-events-none">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl font-semibold mb-2">No cans available</p>
          <p className="text-muted-foreground">
            Check back soon for cans to take home.
          </p>
        </div>
      )}
    </>
  );
}
