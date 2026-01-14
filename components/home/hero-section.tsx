'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Beer as PayloadBeer, Menu as PayloadMenu } from '@/src/payload-types';
import { extractBeerFromMenuItem } from '@/lib/utils/menu-item-utils';

interface HeroSectionProps {
  availableBeers: PayloadBeer[];
  cansMenus: PayloadMenu[];
  heroDescription?: string;
  heroImageUrl?: string | null;
}

function getBeerImageUrl(beer: PayloadBeer): string | null {
  if (beer.image && typeof beer.image === 'object' && 'url' in beer.image) {
    return beer.image.url as string;
  }
  return null;
}

export function HeroSection({ availableBeers, cansMenus, heroDescription, heroImageUrl }: HeroSectionProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageError = (beerId: string) => {
    setImageErrors(prev => new Set(prev).add(beerId));
  };

  const handleImageLoad = (beerId: string) => {
    setLoadedImages(prev => new Set(prev).add(beerId));
  };

  // Build a set of beer IDs that are available in cans menus (memoized)
  const cansAvailableBeerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const menu of cansMenus) {
      if (!menu.items) continue;
      for (const item of menu.items) {
        const beer = extractBeerFromMenuItem(item);
        if (beer?.id) {
          ids.add(beer.id);
        }
      }
    }
    return ids;
  }, [cansMenus]);

  return (
    <div className="relative flex flex-col gap-8 md:gap-16 px-4 md:px-8 py-16 md:py-24 text-center min-h-[600px] md:min-h-[700px]">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt="Interior view of Lolev Beer taproom showing bar area with craft beer taps"
            fill
            className="object-cover object-center"
            priority
            fetchPriority="high"
            quality={90}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-900/20 to-orange-800/30" />
        )}
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/50 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center gap-6 md:gap-8">
        <h1 className="mb-0 text-balance font-bold text-4xl md:text-6xl lg:text-7xl xl:text-[5.25rem] animate-stagger-in opacity-0">
          Lolev Beer
        </h1>
        <section
          className="flex flex-col items-center justify-center gap-4 md:gap-8 rounded-xl py-8 md:py-12 w-full overflow-visible animate-stagger-in opacity-0"
          style={{ animationDelay: '100ms' }}
        >
          <div className="w-full max-w-5xl mx-auto px-4 md:px-12 overflow-visible">
            <TooltipProvider delayDuration={200}>
              <Carousel
                opts={{
                  align: "center",
                  loop: true,
                  slidesToScroll: "auto",
                }}
                className="w-full"
                aria-label="Available beers carousel"
              >
                <CarouselContent className="-ml-4 justify-center">
                  {availableBeers.length > 0 ? (
                    availableBeers.map((beer) => {
                      const imageUrl = getBeerImageUrl(beer);
                      // Skip beers not in cans menus, without images, or with failed images
                      if (!cansAvailableBeerIds.has(beer.id) || !imageUrl || imageErrors.has(beer.id)) return null;

                      return (
                        <CarouselItem key={beer.id} className="pl-4 basis-1/4 sm:basis-1/5 md:basis-1/4 lg:basis-1/6 xl:basis-1/8 2xl:basis-1/8">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/beer/${beer.slug}`} className="group flex justify-center">
                                <div className="relative h-16 w-16 md:h-24 md:w-24 rounded-lg bg-transparent transition-transform duration-200 ease-out group-hover:-translate-y-1 group-hover:scale-105">
                                  <Image
                                    src={imageUrl}
                                    alt={`${beer.name} beer can`}
                                    fill
                                    className={`object-contain drop-shadow-sm group-hover:drop-shadow-md transition-all duration-200 ${loadedImages.has(beer.id) ? 'opacity-100' : 'opacity-0'}`}
                                    sizes="(max-width: 768px) 64px, 96px"
                                    loading="lazy"
                                    onLoad={() => handleImageLoad(beer.id)}
                                    onError={() => handleImageError(beer.id)}
                                  />
                                </div>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-popover text-popover-foreground border-0" sideOffset={5}>
                              <p className="font-semibold text-sm">{beer.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </CarouselItem>
                      );
                    })
                  ) : (
                    <CarouselItem className="pl-4">
                      <div className="h-16 md:h-24 flex items-center justify-center">
                        <p className="text-muted-foreground text-sm">Loading available beers...</p>
                      </div>
                    </CarouselItem>
                  )}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex border-0 bg-transparent hover:bg-muted/50 shadow-none" />
                <CarouselNext className="hidden md:flex border-0 bg-transparent hover:bg-muted/50 shadow-none" />
              </Carousel>
            </TooltipProvider>
          </div>
        </section>
        {heroDescription && (
          <p
            className="mt-0 mb-0 text-balance text-base md:text-lg text-foreground max-w-4xl px-4 whitespace-pre-line animate-stagger-in opacity-0"
            style={{ animationDelay: '200ms' }}
          >
            {heroDescription}
          </p>
        )}

        {/* Primary CTAs */}
        <div
          className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-6 md:mt-8 justify-center items-center animate-stagger-in opacity-0"
          style={{ animationDelay: '300ms' }}
        >
          <Button asChild variant="default" size="lg" className="min-w-[180px] text-base animate-glow-pulse">
            <Link href="/beer-map">
              Find Lolev
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-[140px]">
            <a href="https://squareup.com/customer-programs/enroll/ce5WC6LoELBr?utm_source=lolevwebsite" target="_blank" rel="noopener noreferrer">
              Newsletter
            </a>
          </Button>
          <Button asChild variant="ghost" size="lg" className="min-w-[140px]">
            <Link href="/about">
              Our Story
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
