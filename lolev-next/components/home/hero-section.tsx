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
          alt="Bar background"
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
        <section className="flex flex-col items-center justify-center gap-4 md:gap-8 rounded-xl py-4 md:py-8 w-full">
          <div className="w-full max-w-5xl mx-auto px-4 md:px-12">
            <Carousel
              opts={{
                align: "center",
                loop: true,
                slidesToScroll: "auto",
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-4">
                {availableBeers.length > 0 ? (
                  availableBeers.map((beer) => (
                    <CarouselItem key={beer.variant} className="pl-4 basis-1/4 sm:basis-1/5 md:basis-1/4 lg:basis-1/6 xl:basis-1/8">
                      <Link href={`/beer/${getBeerSlug(beer)}`} className="group flex justify-center">
                        <div className="relative h-16 w-16 md:h-24 md:w-24 overflow-hidden rounded-lg bg-transparent transition-transform group-hover:scale-105">
                          <Image
                            src={`/images/beer/${beer.variant}.webp`}
                            alt={beer.name}
                            fill
                            className="object-contain"
                            sizes="(max-width: 768px) 64px, 96px"
                            loading="lazy"
                          />
                        </div>
                      </Link>
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
              <CarouselPrevious className="hidden md:flex" />
              <CarouselNext className="hidden md:flex" />
            </Carousel>
          </div>
        </section>
        <p className="mt-0 mb-0 text-balance text-base md:text-lg text-foreground max-w-4xl px-4">
          Brewed in Pittsburgh's vibrant Lawrenceville neighborhood, housed in a historic building that has stood since 1912. Lolev focuses on modern ales, expressive lagers and oak-aged beer.
          <br /><br />
          We believe that beer should be thoughtful and stimulating. Each beer we create is intended to engage your senses, crafted with attention to flavor, balance, and the experience.
        </p>
        <Button asChild variant="default" size="lg" className="mt-2 md:mt-6">
          <Link href="/about">
            About Lolev
          </Link>
        </Button>
      </div>
    </div>
  );
}
