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
        const [lawrencevilleRes, zelienopleRes, beerRes] = await Promise.all([
          fetch('/data/lawrenceville-draft.csv'),
          fetch('/data/zelienople-draft.csv'),
          fetch('/data/beer.csv')
        ]);

        const [lawrencevilleText, zelienopleText, beerText] = await Promise.all([
          lawrencevilleRes.text(),
          zelienopleRes.text(),
          beerRes.text()
        ]);

        // Parse beer.csv for complete beer info
        const beerMap = new Map();
        const beerLines = beerText.split('\n').slice(1);
        beerLines.forEach(line => {
          if (line.trim()) {
            const parts = line.split(',');
            const variant = parts[0]?.replace(/"/g, '').trim();
            const name = parts[1]?.replace(/"/g, '').trim();
            const type = parts[2]?.replace(/"/g, '').trim();
            const glass = parts[3]?.replace(/"/g, '').trim();
            const abv = parts[4]?.replace(/"/g, '').trim();

            if (variant) {
              beerMap.set(variant.toLowerCase(), {
                variant,
                name,
                type,
                glass,
                abv
              });
            }
          }
        });

        // Helper function to parse CSV lines with quoted fields
        function parseCSVLine(line) {
          const result = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        }

        const lawrencevilleBeers = [];
        const zelienopleBeers = [];

        // Parse Lawrenceville draft (with quoted values)
        const lawrencevilleLines = lawrencevilleText.split('\n').slice(1); // Skip header
        lawrencevilleLines.forEach(line => {
          if (line.trim()) {
            const parts = parseCSVLine(line);
            const tap = parts[0];
            const variant = parts[1];
            const name = parts[3] || '';
            const type = parts[4] || '';
            const abv = parts[5] || '';
            const glass = parts[6] || '';
            const price = parts[7] || '';
            const description = parts[8] || '';
            const image = parts[9] === 'TRUE';

            if (variant) {
              lawrencevilleBeers.push({
                tap,
                variant,
                name,
                type,
                abv,
                glass,
                price,
                description,
                image
              });
            }
          }
        });

        // Parse Zelienople CSV - handle multiline fields
        const zelienopleRows = [];
        let currentRow = '';
        let inQuotes = false;
        const zelienopleLines = zelienopleText.split('\n');

        for (let i = 1; i < zelienopleLines.length; i++) {
          const line = zelienopleLines[i];

          // Count quotes to determine if we're in a multiline field
          for (let j = 0; j < line.length; j++) {
            if (line[j] === '"') inQuotes = !inQuotes;
          }

          currentRow += (currentRow ? '\n' : '') + line;

          // If quotes are balanced, we have a complete row
          if (!inQuotes) {
            const parts = parseCSVLine(currentRow);
            if (parts[0] && parts[1]) { // Must have tap and variant
              zelienopleRows.push(parts);
            }
            currentRow = '';
          }
        }

        // Process parsed rows
        zelienopleRows.forEach(parts => {
          const tap = parts[0];
          const variant = parts[1];
          const name = parts[3] || '';
          const type = parts[4] || '';
          const abv = parts[5] || '';
          const glass = parts[6] || '';
          const price = parts[7] || '';
          const description = parts[8] || '';
          const image = parts[9] === 'TRUE';

          if (variant) {
            zelienopleBeers.push({
              tap,
              variant,
              name,
              type,
              abv,
              glass,
              price,
              description,
              image
            });
          }
        });

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {featuredBeers.map((beer, index) => (
              <Card key={`${beer.variant}-${index}`} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                <div className={`relative h-48 w-full flex-shrink-0 ${beer.image ? 'bg-gradient-to-b from-muted/10 to-background/50' : ''}`}>
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
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold">{beer.name}</h3>
                      {beer.tap && (
                        <Badge variant="secondary" className="text-xs">
                          Tap {beer.tap}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>{beer.type}</div>
                      <div>{beer.abv}% ABV</div>
                      {beer.description && (
                        <div className="mt-2 text-xs line-clamp-2">{beer.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/beer/${beer.variant.toLowerCase()}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
                    {event.time && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{event.time.trim()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{currentLocation === 'zelienople' ? 'Zelienople' : 'Lawrenceville'}</span>
                    </div>
                    {event.attendees && event.attendees !== '' && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{event.attendees} attending</span>
                      </div>
                    )}
                  </div>

                  {event.site && event.site !== '' && (
                    <div className="mt-4 pt-4 border-t">
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={event.site}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Learn More
                        </a>
                      </Button>
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
