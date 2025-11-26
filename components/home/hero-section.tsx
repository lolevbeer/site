'use client';

import React from 'react';
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
import type { Beer as PayloadBeer } from '@/src/payload-types';

interface HeroSectionProps {
  availableBeers: PayloadBeer[];
  heroDescription?: string;
}

function getBeerImageUrl(beer: PayloadBeer): string | null {
  if (beer.image && typeof beer.image === 'object' && 'url' in beer.image) {
    return beer.image.url as string;
  }
  return null;
}

export function HeroSection({ availableBeers, heroDescription }: HeroSectionProps) {
  return (
    <div className="relative flex flex-col gap-8 md:gap-16 px-4 md:px-8 py-16 md:py-24 text-center min-h-[600px] md:min-h-[700px]">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/bar.jpg"
          alt="Interior view of Lolev Beer taproom showing bar area with craft beer taps"
          fill
          className="object-cover object-center"
          priority
          fetchPriority="high"
          quality={90}
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center gap-6 md:gap-8">
        <h1 className="mb-0 text-balance font-bold text-4xl md:text-6xl lg:text-7xl xl:text-[5.25rem]">
          Lolev Beer
        </h1>
        <section className="flex flex-col items-center justify-center gap-4 md:gap-8 rounded-xl py-8 md:py-12 w-full overflow-visible">
          <div className="w-full max-w-5xl mx-auto px-4 md:px-12 overflow-visible">
            <TooltipProvider delayDuration={200}>
              <Carousel
                opts={{
                  align: "start",
                  loop: true,
                  slidesToScroll: "auto",
                }}
                className="w-full"
                aria-label="Available beers carousel"
              >
                <CarouselContent className="-ml-4">
                  {availableBeers.length > 0 ? (
                    availableBeers.map((beer) => {
                      const imageUrl = getBeerImageUrl(beer);
                      if (!imageUrl) return null;

                      return (
                        <CarouselItem key={beer.id} className="pl-4 basis-1/4 sm:basis-1/5 md:basis-1/4 lg:basis-1/6 xl:basis-1/8 2xl:basis-1/8">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/beer/${beer.slug}`} className="group flex justify-center">
                                <div className="relative h-16 w-16 md:h-24 md:w-24 rounded-lg bg-transparent">
                                  <Image
                                    src={imageUrl}
                                    alt={`${beer.name} beer can`}
                                    fill
                                    className="object-contain"
                                    sizes="(max-width: 768px) 64px, 96px"
                                    loading="lazy"
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
          <p className="mt-0 mb-0 text-balance text-base md:text-lg text-foreground max-w-4xl px-4 whitespace-pre-line">
            {heroDescription}
          </p>
        )}

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-6 md:mt-8 justify-center items-center">
          <Button asChild variant="default" size="lg" className="min-w-[160px]">
            <Link href="/beer-map">
              Find Lolev
            </Link>
          </Button>
          <Button asChild variant="default" size="lg" className="min-w-[160px]">
            <a href="https://squareup.com/customer-programs/enroll/ce5WC6LoELBr?utm_source=lolevwebsite" target="_blank" rel="noopener noreferrer">
              Join Newsletter
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-[160px] backdrop-blur-md bg-transparent border-white hover:bg-white/10">
            <Link href="/about">
              Our Story
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
