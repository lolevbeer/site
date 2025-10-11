'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Papa from 'papaparse';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BeerGrid } from '@/components/beer/beer-grid';
import { LocationTabs } from '@/components/location/location-tabs';
import { LocationCards } from '@/components/location/location-cards';
import { CansGrid } from '@/components/cans/cans-grid';
import { EventCard } from '@/components/events/event-card';
import { useLocationContext } from '@/components/location/location-provider';
import { Calendar, MapPin, Clock, Users, Star } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

function HeroSection() {
  const { currentLocation } = useLocationContext();
  const [availableBeers, setAvailableBeers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAvailableBeers = async () => {
      try {
        // Fetch all data
        const [lawrencevilleDraftRes, zelienopleDraftRes, lawrencevilleCansRes, zelienopleCansRes, beerRes] = await Promise.all([
          fetch('/data/lawrenceville-draft.csv'),
          fetch('/data/zelienople-draft.csv'),
          fetch('/data/lawrenceville-cans.csv'),
          fetch('/data/zelienople-cans.csv'),
          fetch('/data/beer.csv')
        ]);

        const [lawrencevilleDraftText, zelienopleDraftText, lawrencevilleCansText, zelienopleCansText, beerText] = await Promise.all([
          lawrencevilleDraftRes.text(),
          zelienopleDraftRes.text(),
          lawrencevilleCansRes.text(),
          zelienopleCansRes.text(),
          beerRes.text()
        ]);

        const availableVariants = new Set<string>();

        // Parse draft CSVs
        const lawrencevilleDraft = Papa.parse(lawrencevilleDraftText, { header: true });
        const zelienopleDraft = Papa.parse(zelienopleDraftText, { header: true });

        lawrencevilleDraft.data.forEach((row: any) => {
          if (row.variant) availableVariants.add(row.variant.toLowerCase());
        });
        zelienopleDraft.data.forEach((row: any) => {
          if (row.variant) availableVariants.add(row.variant.toLowerCase());
        });

        // Parse cans CSVs
        const lawrencevilleCans = Papa.parse(lawrencevilleCansText, { header: true });
        const zelienopleCans = Papa.parse(zelienopleCansText, { header: true });

        lawrencevilleCans.data.forEach((row: any) => {
          if (row.variant) availableVariants.add(row.variant.toLowerCase());
        });
        zelienopleCans.data.forEach((row: any) => {
          if (row.variant) availableVariants.add(row.variant.toLowerCase());
        });

        // Parse beer.csv
        const beerData = Papa.parse(beerText, { header: true });
        const beersWithImages = beerData.data
          .filter((row: any) =>
            row.variant &&
            availableVariants.has(row.variant.toLowerCase()) &&
            row.image === 'TRUE' &&
            row.hideFromSite !== 'TRUE'
          )
          .map((row: any) => ({
            variant: row.variant,
            name: row.name
          }));

        setAvailableBeers(beersWithImages);
      } catch (error) {
        console.error('Error loading available beers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableBeers();
  }, []);

  // Function to get beer slug for URL
  const getBeerSlug = (beer: any) => {
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
                {loading ? (
                  // Show loading placeholders
                  Array.from({ length: 8 }).map((_, i) => (
                    <CarouselItem key={i} className="pl-4 basis-1/4 sm:basis-1/5 md:basis-1/4 lg:basis-1/6 xl:basis-1/8">
                      <div className="h-16 w-16 md:h-24 md:w-24 rounded-lg bg-muted animate-pulse mx-auto" />
                    </CarouselItem>
                  ))
                ) : availableBeers.length > 0 ? (
                  // Show available beers
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
                  // Show message if no beers available
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
          Brewed in Pittsburgh's vibrant Lawrenceville neighborhood, housed in a historic building that has stood since 1912. Every effort was taken to honor the character and craftsmanship of this century-old structure while creating a space dedicated to our pursuit of exceptional beer.
          <br /><br />
          We believe that beer should be thoughtful and stimulating. Each beer we create is intended to engage your senses, crafted with attention to flavor, balance, and the experience.
        </p>
        <Button asChild variant="default" size="lg" className="mt-2 md:mt-6">
          <Link href="/about">
            More About Lolev
          </Link>
        </Button>
      </div>
    </div>
  );
}

function FeaturedBeers() {
  const { currentLocation } = useLocationContext();
  const [draftBeersByLocation, setDraftBeersByLocation] = useState<{
    lawrenceville: any[];
    zelienople: any[];
  }>({
    lawrenceville: [],
    zelienople: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch draft beers from both locations
    const fetchDraftBeers = async () => {
      try {
        const [lawrencevilleRes, zelienopleRes, lawrencevilleCansRes, zelienopleCansRes, beerRes] = await Promise.all([
          fetch('/data/lawrenceville-draft.csv'),
          fetch('/data/zelienople-draft.csv'),
          fetch('/data/lawrenceville-cans.csv'),
          fetch('/data/zelienople-cans.csv'),
          fetch('/data/beer.csv')
        ]);

        const [lawrencevilleText, zelienopleText, lawrencevilleCansText, zelienopleCansText, beerText] = await Promise.all([
          lawrencevilleRes.text(),
          zelienopleRes.text(),
          lawrencevilleCansRes.text(),
          zelienopleCansRes.text(),
          beerRes.text()
        ]);

        // Parse all CSVs with papaparse
        const lawrencevilleDraft = Papa.parse(lawrencevilleText, { header: true });
        const zelienopleDraft = Papa.parse(zelienopleText, { header: true });
        const lawrencevilleCansData = Papa.parse(lawrencevilleCansText, { header: true });
        const zelienopleCansData = Papa.parse(zelienopleCansText, { header: true });

        // Create cans availability sets
        const lawrencevilleCansSet = new Set<string>();
        lawrencevilleCansData.data.forEach((row: any) => {
          if (row.variant) lawrencevilleCansSet.add(row.variant.toLowerCase());
        });

        const zelienopleCansSet = new Set<string>();
        zelienopleCansData.data.forEach((row: any) => {
          if (row.variant) zelienopleCansSet.add(row.variant.toLowerCase());
        });

        // Parse Lawrenceville draft beers
        const lawrencevilleBeers = lawrencevilleDraft.data
          .filter((row: any) => row.variant)
          .map((row: any) => ({
            tap: row.tap,
            variant: row.variant,
            name: row.name || '',
            type: row.type || '',
            abv: row.abv || '',
            glass: row.glass || '',
            price: row.price || '',
            description: row.description || '',
            image: row.image === 'TRUE',
            cansAvailable: lawrencevilleCansSet.has(row.variant.toLowerCase())
          }));

        // Parse Zelienople draft beers
        const zelienopleBeers = zelienopleDraft.data
          .filter((row: any) => row.variant)
          .map((row: any) => ({
            tap: row.tap,
            variant: row.variant,
            name: row.name || '',
            type: row.type || '',
            abv: row.abv || '',
            glass: row.glass || '',
            price: row.price || '',
            description: row.description || '',
            image: row.image === 'TRUE',
            cansAvailable: zelienopleCansSet.has(row.variant.toLowerCase())
          }));

        console.log('Lawrenceville beers with images:', lawrencevilleBeers.filter(b => b.image).map(b => b.variant));
        console.log('Zelienople beers with images:', zelienopleBeers.filter(b => b.image).map(b => b.variant));
        console.log('All Lawrenceville beers:', lawrencevilleBeers.map(b => ({ variant: b.variant, image: b.image })));

        setDraftBeersByLocation({
          lawrenceville: lawrencevilleBeers,
          zelienople: zelienopleBeers
        });
      } catch (error) {
        console.error('Error loading draft beers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDraftBeers();
  }, []);

  // Get beers based on selected location
  const featuredBeers = currentLocation === 'lawrenceville'
    ? draftBeersByLocation.lawrenceville
    : currentLocation === 'zelienople'
    ? draftBeersByLocation.zelienople
    : [...draftBeersByLocation.lawrenceville, ...draftBeersByLocation.zelienople];

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Draft
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border shadow-sm animate-pulse h-96" />
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 ${featuredBeers.length === 10 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
            {featuredBeers.map((beer, index) => (
              <Link key={`${beer.variant}-${index}`} href={`/beer/${beer.variant.toLowerCase()}`} className="group">
                <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col border-0 h-full cursor-pointer">
                  <div className={`relative h-48 w-full flex-shrink-0 ${beer.image ? 'bg-gradient-to-b from-muted/5 to-background/20' : ''}`}>
                    {beer.image ? (
                      <Image
                        src={`/images/beer/${beer.variant.toLowerCase()}.webp`}
                        alt={beer.name}
                        fill
                        className="object-contain p-4"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        onError={(e) => {
                          // Hide image container if image fails to load
                          e.currentTarget.parentElement.style.display = 'none';
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
                        <div className="flex gap-1 flex-shrink-0">
                          {beer.tap && (
                            <Badge variant="secondary" className="text-xs">
                              Tap {beer.tap}
                            </Badge>
                          )}
                          {beer.cansAvailable && (
                            <Badge variant="default" className="text-xs">
                              Cans
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div>{beer.type}</div>
                        <div>{beer.abv}% ABV</div>
                        {beer.description && (
                          <div className="mt-2 text-xs line-clamp-2">{beer.description}</div>
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
        )}

        <div className="text-center">
          <Button asChild variant="default" size="lg">
            <Link href="/beer">
              View All Beers
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeaturedCans() {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Cans
          </h2>
        </div>

        <div className="mb-8">
          <CansGrid />
        </div>

        <div className="text-center">
          <Button asChild variant="default" size="lg">
            <Link href="/beer">
              View All Beers
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function UpcomingEvents() {
  const { currentLocation } = useLocationContext();
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const csvFile = currentLocation === 'zelienople'
          ? '/data/zelienople-events.csv'
          : '/data/lawrenceville-events.csv';

        const response = await fetch(csvFile);
        const text = await response.text();

        // Parse CSV - handle commas in fields
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const events = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            // Simple CSV parser that handles commas in quoted fields
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let j = 0; j < line.length; j++) {
              const char = line[j];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            values.push(current.trim());

            const event = {
              date: values[0] || '',
              vendor: values[1] || '',
              time: values[2] || '',
              attendees: values[3] || '',
              site: values[4] || '',
              end: values[5] || ''
            };

            // Include today's events and future events
            // Parse date as local time, not UTC
            if (event.date && event.vendor) {
              const [year, month, day] = event.date.split('-').map(Number);
              if (year && month && day) {
                const eventDate = new Date(year, month - 1, day);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (eventDate >= today) {
                  events.push(event);
                }
              }
            }
          }
        }

        // Sort by date and take first 3
        events.sort((a, b) => {
          const [yearA, monthA, dayA] = a.date.split('-').map(Number);
          const [yearB, monthB, dayB] = b.date.split('-').map(Number);
          const dateA = new Date(yearA, monthA - 1, dayA);
          const dateB = new Date(yearB, monthB - 1, dayB);
          return dateA.getTime() - dateB.getTime();
        });
        setUpcomingEvents(events.slice(0, 3));
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [currentLocation]);

  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Upcoming Events
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border shadow-sm animate-pulse h-64" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {upcomingEvents.map((event, index) => (
              <EventCard
                key={index}
                event={event}
                currentLocation={currentLocation}
              />
            ))}
          </div>
        )}

        <div className="text-center">
          <Button asChild variant="default" size="lg">
            <Link href="/events">
              View All
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FoodThisWeek() {
  const { currentLocation } = useLocationContext();
  const [foodVendors, setFoodVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFood = async () => {
      try {
        const csvFile = currentLocation === 'zelienople'
          ? '/data/zelienople-food.csv'
          : '/data/lawrenceville-food.csv';

        const response = await fetch(csvFile);
        const text = await response.text();

        // Parse CSV
        const lines = text.split('\n');
        const vendors = [];

        // Get today's date at midnight local time
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let j = 0; j < line.length; j++) {
              const char = line[j];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            values.push(current.trim());

            const vendor = values[0] || '';
            const date = values[1] || '';
            const time = values[2] || '';
            const site = values[3] || '';
            const day = values[4] || '';

            if (vendor && date) {
              const [year, month, dayNum] = date.split('-').map(Number);
              if (year && month && dayNum) {
                const vendorDate = new Date(year, month - 1, dayNum);

                if (vendorDate >= today) {
                  vendors.push({ vendor, date, time, site, day });
                }
              }
            }
          }
        }

        // Sort by date and take first 3
        vendors.sort((a, b) => {
          const [yearA, monthA, dayA] = a.date.split('-').map(Number);
          const [yearB, monthB, dayB] = b.date.split('-').map(Number);
          const dateA = new Date(yearA, monthA - 1, dayA);
          const dateB = new Date(yearB, monthB - 1, dayB);
          return dateA.getTime() - dateB.getTime();
        });

        setFoodVendors(vendors.slice(0, 3));
      } catch (error) {
        console.error('Error loading food vendors:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFood();
  }, [currentLocation]);

  if (loading) {
    return (
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Upcoming Food
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border shadow-sm animate-pulse h-32" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (foodVendors.length === 0) {
    return null;
  }

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Upcoming Food
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {foodVendors.map((food, index) => (
            <Card
              key={index}
              className={`overflow-hidden hover:shadow-lg transition-shadow border-0 ${food.site ? 'cursor-pointer' : ''}`}
              onClick={() => food.site && window.open(food.site, '_blank')}
            >
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-2">{food.vendor}</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{(() => {
                      const [year, month, day] = food.date.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      return date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()}</span>
                  </div>
                  {food.time && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{food.time}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{currentLocation === 'zelienople' ? 'Zelienople' : 'Lawrenceville'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button asChild variant="default" size="lg">
            <Link href="/food">
              View All
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function LocationsSection() {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Our Locations
          </h2>
        </div>

        <LocationCards />
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturedBeers />
      <FeaturedCans />
      <FoodThisWeek />
      <UpcomingEvents />
      <LocationsSection />
    </div>
  );
}
