'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Beer, MapPin } from 'lucide-react';
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

interface Beer {
  variant: string;
  name: string;
}

interface HeroSectionProps {
  availableBeers: Beer[];
}

export function HeroSection({ availableBeers }: HeroSectionProps) {
  const getBeerSlug = (beer: Beer) => {
    return beer.variant.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  };

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
                    availableBeers.map((beer) => (
                      <CarouselItem key={beer.variant} className="pl-4 basis-1/4 sm:basis-1/5 md:basis-1/4 lg:basis-1/6 xl:basis-1/8 2xl:basis-1/8">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={`/beer/${getBeerSlug(beer)}`} className="group flex justify-center">
                              <div className="relative h-16 w-16 md:h-24 md:w-24 rounded-lg bg-transparent">
                                <Image
                                  src={`/images/beer/${beer.variant}.webp`}
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
                    ))
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
        <p className="mt-0 mb-0 text-balance text-base md:text-lg text-foreground max-w-4xl px-4">
          Brewed in Pittsburgh's vibrant Lawrenceville neighborhood, housed in a historic building that has stood since 1912. Lolev focuses on modern ales, expressive lagers and oak-aged beer.
          <br /><br />
          We believe that beer should be thoughtful and stimulating. Each beer we create is intended to engage your senses, crafted with attention to flavor, balance, and the experience.
        </p>

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-6 md:mt-8 justify-center items-center">
          <Button asChild variant="outline" size="lg" className="min-w-[160px] backdrop-blur-md bg-transparent">
            <Link href="/beer">
              Explore Beers
            </Link>
          </Button>
          <Button asChild variant="default" size="lg" className="min-w-[160px]">
            <Link href="/beer-map">
              Find Lolev
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-[160px] backdrop-blur-md bg-transparent">
            <Link href="/about">
              Our Story
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
