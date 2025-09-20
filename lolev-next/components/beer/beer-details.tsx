/**
 * Beer Details Component
 * Displays comprehensive beer information for individual beer pages
 */

'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Beer, GlassType } from '@/lib/types/beer';
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
  Beer as BeerIcon,
  Wine,
  GlassWater,
  Flame,
  ClipboardList,
  Tag,
  Package,
  CircleX,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';

interface BeerDetailsProps {
  beer: Beer;
  className?: string;
}

function getGlassIcon(glass: GlassType): React.ComponentType<{ className?: string }> {
  switch (glass) {
    case GlassType.PINT:
      return BeerIcon;
    case GlassType.TEKU:
      return Wine;
    case GlassType.STEIN:
      return GlassWater;
    default:
      return BeerIcon;
  }
}

function getGlassDescription(glass: GlassType): string {
  switch (glass) {
    case GlassType.PINT:
      return 'Served in a classic pint glass';
    case GlassType.TEKU:
      return 'Served in a Teku glass to enhance aromatics';
    case GlassType.STEIN:
      return 'Served in a traditional stein';
    default:
      return 'Served in appropriate glassware';
  }
}

function getBeerImagePath(beer: Beer): string | null {
  if (!beer.image || beer.image === false || beer.image === 'FALSE') {
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
    details.push(`Available on Tap ${beer.availability.tap}`);
    status = 'On Tap';
    isDraft = true;
  }

  if (beer.availability.cansAvailable) {
    details.push('Cans available for purchase');
    isCanned = true;
    if (!isDraft) {
      status = 'Cans Available';
    } else {
      status = 'On Tap & Cans';
    }
  }

  if (beer.availability.singleCanAvailable) {
    details.push('Single cans available');
    isCanned = true;
  }

  return { status, details, isDraft, isCanned };
}

function getPricingInfo(beer: Beer): {
  draftPrice?: string;
  singlePrice?: string;
  fourPackPrice?: string;
  hasSale: boolean;
} {
  return {
    draftPrice: beer.pricing.draftPrice,
    singlePrice: beer.pricing.canSingle || beer.pricing.cansSingle,
    fourPackPrice: beer.pricing.fourPack,
    hasSale: beer.pricing.salePrice || false,
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

export function BeerDetails({ beer, className = '' }: BeerDetailsProps) {
  const { currentLocation } = useLocationContext();
  const imagePath = getBeerImagePath(beer);
  const availability = getAvailabilityInfo(beer);
  const pricing = getPricingInfo(beer);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Beer Image */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full max-w-md mx-auto overflow-hidden rounded-xl bg-muted/30">
            {imagePath ? (
              <Image
                src={imagePath}
                alt={`${beer.name} beer`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
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
          <Card>
            <CardContent className="pt-6 space-y-0">
              <SpecificationRow
                label="Style"
                value={beer.type}
                icon={BeerIcon}
              />
              <SpecificationRow
                label="ABV"
                value={formatAbv(beer.abv)}
                icon={Flame}
              />
              <SpecificationRow
                label="Glassware"
                value={getGlassDescription(beer.glass)}
                icon={getGlassIcon(beer.glass)}
              />
              {beer.recipe && (
                <SpecificationRow
                  label="Recipe #"
                  value={beer.recipe}
                  icon={ClipboardList}
                />
              )}
              {beer.upc && (
                <SpecificationRow
                  label="UPC"
                  value={beer.upc}
                  icon={Tag}
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
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="text-sm">
                {beer.type}
              </Badge>
              <Badge variant="secondary" className="text-sm">
                {formatAbv(beer.abv)} ABV
              </Badge>
              {availability.isDraft && (
                <Badge variant="default">
                  On Tap
                </Badge>
              )}
              {availability.isCanned && (
                <Badge variant="outline">
                  Cans
                </Badge>
              )}
              {pricing.hasSale && (
                <Badge variant="destructive">
                  Sale
                </Badge>
              )}
            </div>
            {beer.options && (
              <p className="text-muted-foreground mb-4">{beer.options}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Description</h2>
            <p>
              {beer.description}
            </p>
          </div>

          {/* Hops */}
          {beer.hops && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Hops</h2>
              <p>{beer.hops}</p>
            </div>
          )}

          {/* Availability */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status:</span>
                  <Badge variant={availability.isDraft || availability.isCanned ? 'default' : 'outline'}>
                    {availability.status}
                  </Badge>
                </div>
                {availability.details.map((detail, index) => (
                  <p key={index} className="text-sm text-muted-foreground">
                    • {detail}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          {(pricing.draftPrice || pricing.singlePrice || pricing.fourPackPrice) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Pricing
                  {pricing.hasSale && (
                    <Badge variant="destructive" className="text-xs">
                      Sale Price
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                {pricing.draftPrice && (
                  <SpecificationRow
                    label="Draft"
                    value={`$${pricing.draftPrice}`}
                    icon={BeerIcon}
                  />
                )}
                {pricing.singlePrice && (
                  <SpecificationRow
                    label="Single Can"
                    value={`$${pricing.singlePrice}`}
                    icon={GlassWater}
                  />
                )}
                {pricing.fourPackPrice && (
                  <SpecificationRow
                    label="4-Pack"
                    value={`$${pricing.fourPackPrice}`}
                    icon={Package}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* External Links */}
          <div className="flex gap-4">
            {beer.untappd && (
              <Button variant="outline" asChild>
                <a
                  href={`https://untappd.com/b/-/${beer.untappd}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                >
                  <>
                    View on Untappd
                    <ExternalLink className="h-4 w-4 ml-1" />
                  </>
                </a>
              </Button>
            )}
            <Button asChild>
              <Link href={`/${currentLocation}/beer`}>
                <>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Beer List
                  </>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BeerDetails;