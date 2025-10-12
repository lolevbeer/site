/**
 * Beer Details Component
 * Displays comprehensive beer information for individual beer pages
 */

'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Papa from 'papaparse';
import { Beer } from '@/lib/types/beer';
import { useLocationContext } from '@/components/location/location-provider';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  CircleX,
} from 'lucide-react';
import { UntappdIcon } from '@/components/icons/untappd-icon';
import { getGlassIcon } from '@/lib/utils/beer-icons';

interface BeerDetailsProps {
  beer: Beer;
  className?: string;
}

function getBeerImagePath(beer: Beer): string | null {
  if (!beer.image) {
    return null;
  }
  return `/images/beer/${beer.variant}.webp`;
}

function formatAbv(abv: number): string {
  return `${abv.toFixed(1)}%`;
}

function getAvailabilityInfo(beer: Beer): {
  status: string;
  details: string[];
  isDraft: boolean;
  isCanned: boolean;
} {
  const details: string[] = [];
  let status = 'Limited Availability';
  let isDraft = false;
  let isCanned = false;

  if (beer.availability.tap) {
    details.push(`Pouring ${beer.availability.tap}`);
    status = 'Pouring';
    isDraft = true;
  }

  if (beer.availability.cansAvailable) {
    details.push('Cans available for purchase');
    isCanned = true;
    if (!isDraft) {
      status = 'Cans Available';
    } else {
      status = 'Pouring & Cans';
    }
  }

  if (beer.availability.singleCanAvailable) {
    details.push('Single cans available');
    isCanned = true;
  }

  return { status, details, isDraft, isCanned };
}

function getPricingInfo(beer: Beer): {
  draftPrice?: number;
  singlePrice?: number;
  fourPackPrice?: number;
  hasSale: boolean;
} {
  return {
    draftPrice: beer.pricing.draftPrice,
    singlePrice: beer.pricing.canSingle || beer.pricing.cansSingle,
    fourPackPrice: beer.pricing.fourPack,
    hasSale: beer.pricing.salePrice === true,
  };
}

function SpecificationRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-b-0">
      <span className="text-muted-foreground flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// Type for CSV row data
interface CsvRow {
  variant?: string;
  [key: string]: string | undefined;
}

export function BeerDetails({ beer, className = '' }: BeerDetailsProps) {
  const { currentLocation } = useLocationContext();
  const imagePath = getBeerImagePath(beer);
  const availability = getAvailabilityInfo(beer);
  const pricing = getPricingInfo(beer);
  const GlassIcon = getGlassIcon(beer.glass);
  const [tapLocations, setTapLocations] = useState<string[]>([]);
  const [canLocations, setCanLocations] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoadingLocations(true);
      setLocationError(null);

      try {
        const [lawrencevilleDraftRes, zelienopleDraftRes, lawrencevilleCansRes, zelienopleCansRes] = await Promise.all([
          fetch('/data/lawrenceville-draft.csv'),
          fetch('/data/zelienople-draft.csv'),
          fetch('/data/lawrenceville-cans.csv'),
          fetch('/data/zelienople-cans.csv')
        ]);

        const [lawrencevilleDraftText, zelienopleDraftText, lawrencevilleCansText, zelienopleCansText] = await Promise.all([
          lawrencevilleDraftRes.text(),
          zelienopleDraftRes.text(),
          lawrencevilleCansRes.text(),
          zelienopleCansRes.text()
        ]);

        // Parse CSVs with papaparse - type the results properly
        const lawrencevilleDraft = Papa.parse<CsvRow>(lawrencevilleDraftText, { header: true });
        const zelienopleDraft = Papa.parse<CsvRow>(zelienopleDraftText, { header: true });
        const lawrencevilleCans = Papa.parse<CsvRow>(lawrencevilleCansText, { header: true });
        const zelienopleCans = Papa.parse<CsvRow>(zelienopleCansText, { header: true });

        const tapLocs: string[] = [];
        const canLocs: string[] = [];
        const beerVariantLower = beer.variant.toLowerCase();

        // Check draft availability with proper typing
        if (lawrencevilleDraft.data.some((row) => row.variant?.toLowerCase() === beerVariantLower)) {
          tapLocs.push('Lawrenceville');
        }
        if (zelienopleDraft.data.some((row) => row.variant?.toLowerCase() === beerVariantLower)) {
          tapLocs.push('Zelienople');
        }

        // Check can availability with proper typing
        if (lawrencevilleCans.data.some((row) => row.variant?.toLowerCase() === beerVariantLower)) {
          canLocs.push('Lawrenceville');
        }
        if (zelienopleCans.data.some((row) => row.variant?.toLowerCase() === beerVariantLower)) {
          canLocs.push('Zelienople');
        }

        setTapLocations(tapLocs);
        setCanLocations(canLocs);
      } catch (error) {
        console.error('Error fetching beer location data:', error);
        setLocationError('Unable to load location information. Please try again later.');
      } finally {
        setIsLoadingLocations(false);
      }
    };

    fetchLocations();
  }, [beer.variant]);

  // Don't render if beer is hidden from site
  if (beer.availability.hideFromSite) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
        <CircleX className="h-16 w-16 mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-2">Beer Not Available</h2>
        <p>
          This beer is currently not available on our website.
        </p>
        <Button asChild>
          <Link href={`/${currentLocation}/beer`}>
            Browse Available Beers
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/beer">Beer</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{beer.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 mb-8">
        {/* Beer Image and Quick Stats */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl">
            {imagePath ? (
              <Image
                src={imagePath}
                alt={`${beer.name} beer`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 350px"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400 dark:text-gray-500 font-medium text-lg">No Image</span>
              </div>
            )}
            {beer.glutenFree && (
              <Badge
                variant="secondary"
                className="absolute top-4 right-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
              >
                Gluten Free
              </Badge>
            )}
          </div>

          {/* Quick Stats */}
          <Card className="shadow-none border-0 p-0 bg-transparent">
            <CardContent className="p-0 space-y-0">
              <SpecificationRow
                label="Style"
                value={beer.type}
              />
              <SpecificationRow
                label="Alc by Vol"
                value={formatAbv(beer.abv)}
              />
              {beer.recipe && (
                <SpecificationRow
                  label="Recipe #"
                  value={beer.recipe}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Beer Information */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">{beer.name}</h1>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {availability.isDraft && (
                <Badge variant="default" className="text-sm flex items-center gap-1">
                  <GlassIcon className="h-3.5 w-3.5" />
                  Pouring
                </Badge>
              )}
              {availability.isCanned && (
                <Badge variant="default" className="text-sm">
                  Cans Available
                </Badge>
              )}
              {pricing.hasSale && (
                <Badge variant="destructive" className="text-sm">
                  Sale
                </Badge>
              )}
            </div>
            {beer.options && (
              <p className="text-muted-foreground mb-4">{beer.options}</p>
            )}
          </div>

          {/* Description */}
          {beer.description && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Description</h2>
              <p>
                {beer.description}
              </p>
            </div>
          )}

          {/* Hops */}
          {beer.hops && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Hops</h2>
              <p>{beer.hops}</p>
            </div>
          )}

          {/* Availability and Pricing */}
          <div className="space-y-6">
            {/* Availability */}
            <Card className="shadow-none border-0 p-0 bg-transparent">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">Availability</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingLocations ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                  </div>
                ) : locationError ? (
                  <p className="text-sm text-destructive">{locationError}</p>
                ) : (
                  <div className="space-y-2">
                    {tapLocations.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        • Pouring at {tapLocations.join(' and ')}
                      </p>
                    )}
                    {canLocations.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        • Cans available at {canLocations.join(' and ')}
                      </p>
                    )}
                    {tapLocations.length === 0 && canLocations.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Not currently available in Lawrenceville or Zelienople
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing */}
            {((tapLocations.length > 0 && pricing.draftPrice) || (canLocations.length > 0 && pricing.fourPackPrice)) && (
              <Card className="shadow-none border-0 p-0 bg-transparent">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    Pricing
                    {pricing.hasSale && (
                      <Badge variant="destructive" className="text-xs">
                        Sale Price
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-2">
                    {tapLocations.length > 0 && pricing.draftPrice && (
                      <p className="text-sm text-muted-foreground">
                        • Draft ${pricing.draftPrice}
                      </p>
                    )}
                    {canLocations.length > 0 && pricing.fourPackPrice && (
                      <p className="text-sm text-muted-foreground">
                        • 4 Pack ${pricing.fourPackPrice}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* External Links */}
          {beer.untappd && (
            <div>
              <Button variant="ghost" asChild>
                <a
                  href={`https://untappd.com/b/-/${beer.untappd}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                >
                  <>
                    <UntappdIcon className="h-5 w-5" />
                    Untappd
                  </>
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BeerDetails;