'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Papa from 'papaparse';

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
  recipe?: number;
}

interface CansGridProps {
  maxItems?: number;
}

interface CSVRow {
  variant?: string;
  fourPack?: string;
  [key: string]: string | undefined;
}

interface BeerCSVRow extends CSVRow {
  name?: string;
  type?: string;
  abv?: string;
  image?: string;
  glass?: string;
  recipe?: string;
}

export function CansGrid({ maxItems }: CansGridProps) {
  const { currentLocation, locations } = useLocationContext();
  const [cans, setCans] = useState<CanBeer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCans = async () => {
      try {
        // Get location slugs dynamically from context
        const locationSlugs = locations.map(loc => loc.slug || loc.id);

        // Fetch cans and draft CSVs for all locations, plus beer data
        const cansPromises = locationSlugs.map(slug => fetch(`/data/${slug}-cans.csv`).catch(() => null));
        const draftPromises = locationSlugs.map(slug => fetch(`/data/${slug}-draft.csv`).catch(() => null));
        const beerPromise = fetch('/data/beer.csv');

        const [cansResponses, draftResponses, beerRes] = await Promise.all([
          Promise.all(cansPromises),
          Promise.all(draftPromises),
          beerPromise
        ]);

        // Parse text from successful responses
        const cansTexts = await Promise.all(
          cansResponses.map(async (res, i) => {
            if (res?.ok) {
              return { slug: locationSlugs[i], text: await res.text() };
            }
            return null;
          })
        );
        const draftTexts = await Promise.all(
          draftResponses.map(async (res, i) => {
            if (res?.ok) {
              return { slug: locationSlugs[i], text: await res.text() };
            }
            return null;
          })
        );
        const beerText = await beerRes.text();

        // Build on-draft set from all locations
        const onDraftSet = new Set<string>();
        draftTexts.forEach(item => {
          if (!item) return;
          const draftData = Papa.parse<CSVRow>(item.text, { header: true });
          draftData.data.forEach((row: CSVRow) => {
            if (row.variant) onDraftSet.add(row.variant.toLowerCase());
          });
        });

        // Parse beer.csv
        const beerData = Papa.parse<BeerCSVRow>(beerText, { header: true });
        const beerMap = new Map<string, Omit<CanBeer, 'fourPackPrice' | 'onDraft'>>();
        beerData.data.forEach((row: BeerCSVRow) => {
          if (row.variant) {
            beerMap.set(row.variant.toLowerCase(), {
              variant: row.variant,
              name: row.name || '',
              type: row.type || '',
              abv: row.abv || '',
              image: row.image === 'TRUE' || row.image === 'true',
              glass: row.glass,
              recipe: row.recipe ? parseInt(row.recipe) : 0
            });
          }
        });

        // Parse cans for each location
        const cansByLocation: Record<string, CanBeer[]> = {};
        cansTexts.forEach(item => {
          if (!item) return;
          const { slug, text } = item;
          const cansData = Papa.parse<CSVRow>(text, { header: true });
          cansByLocation[slug] = cansData.data
            .filter((row: CSVRow) => row.variant)
            .map((row: CSVRow) => {
              const beerInfo = beerMap.get(row.variant!.toLowerCase());
              if (beerInfo) {
                return {
                  ...beerInfo,
                  fourPackPrice: row.fourPack ? `$${row.fourPack}` : '',
                  onDraft: onDraftSet.has(row.variant!.toLowerCase())
                };
              }
              return null;
            })
            .filter((beer): beer is CanBeer => beer !== null);
        });

        // Select cans based on current location filter
        let selectedCans: CanBeer[];
        if (currentLocation === 'all') {
          // Combine all locations, dedupe by variant
          const seen = new Set<string>();
          selectedCans = Object.values(cansByLocation).flat().filter(beer => {
            if (seen.has(beer.variant.toLowerCase())) return false;
            seen.add(beer.variant.toLowerCase());
            return true;
          });
        } else {
          selectedCans = cansByLocation[currentLocation] || [];
        }

        // Sort by recipe number descending (newest/highest recipe first)
        selectedCans.sort((a, b) => (b.recipe || 0) - (a.recipe || 0));

        setCans(maxItems ? selectedCans.slice(0, maxItems) : selectedCans);
      } catch (error) {
        console.error('Error loading cans:', error);
      } finally {
        setLoading(false);
      }
    };

    if (locations.length > 0) {
      fetchCans();
    }
  }, [currentLocation, locations, maxItems]);

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
            <div key={`${beer.variant}-${index}`} className="group flex flex-col">
              <div className="relative h-64 w-full flex-shrink-0 mb-4">
                {beer.image ? (
                  <Image
                    src={`/images/beer/${beer.variant.toLowerCase()}.webp`}
                    alt={beer.name}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
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
              <div className="mb-3">
                <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                  <h3 className="text-lg font-semibold">{beer.name}</h3>
                  <Badge variant="outline" className="text-xs">
                    {beer.type}
                  </Badge>
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
              </div>
              <Button asChild variant="outline" size="default" className="w-full">
                <Link href={`/beer/${beer.variant.toLowerCase()}`}>
                  View Details
                </Link>
              </Button>
            </div>
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
