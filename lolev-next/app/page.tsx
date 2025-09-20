'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BeerGrid } from '@/components/beer/beer-grid';
import { LocationTabs } from '@/components/location/location-tabs';
import { LocationCards } from '@/components/location/location-cards';
import { useLocationContext } from '@/components/location/location-provider';
import { beers } from '@/lib/data/beer-data';
import { Calendar, MapPin, Clock, Users, Star } from 'lucide-react';
import {
  Announcement,
  AnnouncementTag,
  AnnouncementTitle,
} from '@/components/ui/shadcn-io/announcement';
import {
  Marquee,
  MarqueeContent,
  MarqueeFade,
  MarqueeItem,
} from '@/components/ui/shadcn-io/marquee';

function HeroSection() {
  const { currentLocation } = useLocationContext();
  const [availableBeers, setAvailableBeers] = useState<typeof beers>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAvailableBeers = async () => {
      try {
        // Fetch all availability data
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

        const availableVariants = new Set<string>();

        // Parse draft CSVs
        const parseDraftCSV = (text: string) => {
          const lines = text.split('\n').slice(1); // Skip header
          lines.forEach(line => {
            if (line.trim()) {
              const parts = line.split(',');
              let variant = parts[1]?.replace(/"/g, '').trim();
              if (variant) {
                availableVariants.add(variant.toLowerCase());
              }
            }
          });
        };

        // Parse cans CSVs
        const parseCansCSV = (text: string) => {
          const lines = text.split('\n').slice(1); // Skip header
          lines.forEach(line => {
            if (line.trim()) {
              const parts = line.split(',');
              let variant = parts[0]?.replace(/"/g, '').trim();
              if (variant) {
                availableVariants.add(variant.toLowerCase());
              }
            }
          });
        };

        parseDraftCSV(lawrencevilleDraftText);
        parseDraftCSV(zelienopleDraftText);
        parseCansCSV(lawrencevilleCansText);
        parseCansCSV(zelienopleCansText);

        // Filter beers that are available and have images
        const filteredBeers = beers.filter(beer => {
          const normalizedVariant = beer.variant.toLowerCase();
          return availableVariants.has(normalizedVariant) &&
                 beer.image === true &&
                 !beer.availability.hideFromSite;
        });

        setAvailableBeers(filteredBeers);
      } catch (error) {
        console.error('Error loading available beers:', error);
        // Fallback to showing all beers with images
        setAvailableBeers(beers.filter(beer => beer.image === true && !beer.availability.hideFromSite));
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableBeers();
  }, []);

  // Function to get beer slug for URL
  const getBeerSlug = (beer: typeof beers[0]) => {
    return beer.variant.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  };

  return (
    <div className="relative flex flex-col gap-16 px-8 py-24 text-center">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/bar.jpg"
          alt="Bar background"
          fill
          className="object-cover"
          priority
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center gap-8">
        <h1 className="mb-0 text-balance font-medium text-6xl md:text-7xl xl:text-[5.25rem]">
          Lolev Beer
        </h1>
        <p className="mt-0 mb-0 text-balance text-lg text-muted-foreground">
          Haze • Crispy • Funky • Oaked
        </p>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="#">Shop</Link>
          </Button>
          <Button asChild variant="outline">
            <Link className="no-underline" href="#">
              Learn more
            </Link>
          </Button>
        </div>
      </div>
      <section className="relative z-10 flex flex-col items-center justify-center gap-8 rounded-xl py-8">
        <div className="flex size-full items-center justify-center">
          <Marquee>
            <MarqueeFade className="from-background" side="left" />
            <MarqueeFade className="from-background" side="right" />
            <MarqueeContent pauseOnHover={true} speed={40}>
              {loading ? (
                // Show loading placeholders
                Array.from({ length: 8 }).map((_, i) => (
                  <MarqueeItem className="mx-8" key={i}>
                    <div className="h-32 w-32 rounded-lg bg-muted animate-pulse" />
                  </MarqueeItem>
                ))
              ) : availableBeers.length > 0 ? (
                // Show available beers
                availableBeers.map((beer) => (
                  <MarqueeItem className="mx-8" key={beer.variant}>
                    <Link href={`/beer/${getBeerSlug(beer)}`} className="group">
                      <div className="relative h-32 w-32 overflow-hidden rounded-lg bg-transparent transition-transform group-hover:scale-105">
                        <Image
                          src={`/images/beer/${beer.variant}.webp`}
                          alt={beer.name}
                          fill
                          className="object-contain"
                          sizes="128px"
                          loading="lazy"
                        />
                      </div>
                    </Link>
                  </MarqueeItem>
                ))
              ) : (
                // Show message if no beers available
                <MarqueeItem className="mx-8">
                  <div className="h-32 flex items-center px-4">
                    <p className="text-muted-foreground">Loading available beers...</p>
                  </div>
                </MarqueeItem>
              )}
            </MarqueeContent>
          </Marquee>
        </div>
      </section>
    </div>
  );
}

function FeaturedBeers() {
  const { currentLocation } = useLocationContext();
  const [draftVariantsByLocation, setDraftVariantsByLocation] = useState<{
    lawrenceville: Set<string>;
    zelienople: Set<string>;
  }>({
    lawrenceville: new Set(),
    zelienople: new Set()
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch draft beers from both locations
    const fetchDraftBeers = async () => {
      try {
        const [lawrencevilleRes, zelienopleRes] = await Promise.all([
          fetch('/data/lawrenceville-draft.csv'),
          fetch('/data/zelienople-draft.csv')
        ]);

        const [lawrencevilleText, zelienopleText] = await Promise.all([
          lawrencevilleRes.text(),
          zelienopleRes.text()
        ]);

        const lawrencevilleVariants = new Set<string>();
        const zelienopleVariants = new Set<string>();

        // Parse Lawrenceville draft (with quoted values)
        const lawrencevilleLines = lawrencevilleText.split('\n').slice(1); // Skip header
        lawrencevilleLines.forEach(line => {
          if (line.trim()) {
            const parts = line.split(',');
            let variant = parts[1]?.replace(/"/g, '').trim();
            if (variant) {
              // Normalize variant names (handle case differences like priscus-ii vs priscus-II)
              variant = variant.toLowerCase();
              lawrencevilleVariants.add(variant);
            }
          }
        });

        // Parse Zelienople draft (without quotes)
        const zelienopleLines = zelienopleText.split('\n').slice(1); // Skip header
        zelienopleLines.forEach(line => {
          if (line.trim()) {
            const parts = line.split(',');
            let variant = parts[1]?.replace(/"/g, '').trim();
            if (variant) {
              // Normalize variant names (handle case differences)
              variant = variant.toLowerCase();
              zelienopleVariants.add(variant);
            }
          }
        });

        console.log('Lawrenceville variants:', Array.from(lawrencevilleVariants));
        console.log('Zelienople variants:', Array.from(zelienopleVariants));

        setDraftVariantsByLocation({
          lawrenceville: lawrencevilleVariants,
          zelienople: zelienopleVariants
        });
      } catch (error) {
        console.error('Error loading draft beers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDraftBeers();
  }, []);

  // Filter beers based on selected location
  const featuredBeers = beers.filter(beer => {
    const normalizedVariant = beer.variant.toLowerCase();
    if (currentLocation === 'lawrenceville') {
      return draftVariantsByLocation.lawrenceville.has(normalizedVariant);
    } else if (currentLocation === 'zelienople') {
      return draftVariantsByLocation.zelienople.has(normalizedVariant);
    } else {
      // 'both' - show beers from either location
      return draftVariantsByLocation.lawrenceville.has(normalizedVariant) ||
             draftVariantsByLocation.zelienople.has(normalizedVariant);
    }
  });

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Currently Available
          </h2>
          <p>
            Fresh from our taps at both locations - visit us to enjoy these beers today
          </p>
        </div>

        <div className="mb-8">
          <LocationTabs syncWithGlobalState={true}>
            {/* Tab content is handled by the beer grid below */}
          </LocationTabs>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border shadow-sm animate-pulse h-96" />
            ))}
          </div>
        ) : (
          <BeerGrid
            beers={featuredBeers}
            showLocation={false}
            className="mb-8"
          />
        )}

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
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

        // Parse CSV
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const events = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const values = line.split(',');
            const event = {
              date: values[0],
              vendor: values[1],
              time: values[2],
              attendees: values[3],
              site: values[4],
              end: values[5]
            };

            // Include today's events and future events
            // Parse date as local time, not UTC
            const [year, month, day] = event.date.split('-').map(Number);
            const eventDate = new Date(year, month - 1, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (eventDate >= today) {
              events.push(event);
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
    <section className="py-16 lg:py-24 bg-muted/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Upcoming Events
          </h2>
          <p>
            Join us for trivia nights, live music, food trucks, and more exciting events
          </p>
        </div>

        <div className="mb-8">
          <LocationTabs syncWithGlobalState={true}>
            {/* Tab content is handled by the events list below */}
          </LocationTabs>
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
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">{event.vendor}</h3>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{(() => {
                        const [year, month, day] = event.date.split('-').map(Number);
                        const date = new Date(year, month - 1, day);
                        return date.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        });
                      })()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{event.time} ET</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{currentLocation === 'zelienople' ? 'Zelienople' : 'Lawrenceville'}</span>
                    </div>
                    {event.attendees && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{event.attendees} attending</span>
                      </div>
                    )}
                  </div>

                  {event.site && (
                    <div className="mt-4 pt-4 border-t">
                      <a
                        href={event.site}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm"
                      >
                        Learn More →
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/events">
              View All Events
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
          <p>
            Visit us at either of our welcoming taproom locations in the Pittsburgh area
          </p>
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
      <UpcomingEvents />
      <LocationsSection />
    </div>
  );
}
