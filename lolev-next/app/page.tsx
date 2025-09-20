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
import { events } from '@/lib/data/events-data';
import { Calendar, MapPin, Clock, Users, Star } from 'lucide-react';
import {
  SiApple,
  SiFacebook,
  SiGithub,
  SiGoogle,
  SiInstagram,
  SiX,
  SiYoutube,
} from '@icons-pack/react-simple-icons';
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

const logos = [
  {
    name: 'GitHub',
    icon: SiGithub,
    url: 'https://github.com',
  },
  {
    name: 'Facebook',
    icon: SiFacebook,
    url: 'https://facebook.com',
  },
  {
    name: 'Google',
    icon: SiGoogle,
    url: 'https://google.com',
  },
  {
    name: 'X',
    icon: SiX,
    url: 'https://x.com',
  },
  {
    name: 'Apple',
    icon: SiApple,
    url: 'https://apple.com',
  },
  {
    name: 'Instagram',
    icon: SiInstagram,
    url: 'https://instagram.com',
  },
  {
    name: 'YouTube',
    icon: SiYoutube,
    url: 'https://youtube.com',
  },
];

function HeroSection() {
  return (
    <div className="flex flex-col gap-16 px-8 py-24 text-center">
      <div className="flex flex-col items-center justify-center gap-8">
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
      <section className="flex flex-col items-center justify-center gap-8 rounded-xl bg-secondary py-8 pb-18">
        <p className="mb-0 text-balance font-medium text-muted-foreground">
          Trusted by developers from leading companies
        </p>
        <div className="flex size-full items-center justify-center">
          <Marquee>
            <MarqueeFade className="from-secondary" side="left" />
            <MarqueeFade className="from-secondary" side="right" />
            <MarqueeContent pauseOnHover={false}>
              {logos.map((logo) => (
                <MarqueeItem className="mx-16 size-12" key={logo.name}>
                  <Link href={logo.url}>
                    <logo.icon className="size-full" />
                  </Link>
                </MarqueeItem>
              ))}
            </MarqueeContent>
          </Marquee>
        </div>
      </section>
    </div>
  );
}

function FeaturedBeers() {
  const [onDraftVariants, setOnDraftVariants] = useState<Set<string>>(new Set());
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

        const variants = new Set<string>();

        // Parse Lawrenceville draft
        const lawrencevilleLines = lawrencevilleText.split('\n').slice(1); // Skip header
        lawrencevilleLines.forEach(line => {
          if (line.trim()) {
            const parts = line.split(',');
            const variant = parts[1]?.replace(/"/g, '').trim();
            if (variant) {
              variants.add(variant);
            }
          }
        });

        // Parse Zelienople draft
        const zelienopleLines = zelienopleText.split('\n').slice(1); // Skip header
        zelienopleLines.forEach(line => {
          if (line.trim()) {
            const parts = line.split(',');
            const variant = parts[1]?.replace(/"/g, '').trim();
            if (variant) {
              variants.add(variant);
            }
          }
        });

        setOnDraftVariants(variants);
      } catch (error) {
        console.error('Error loading draft beers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDraftBeers();
  }, []);

  const featuredBeers = beers.filter(beer => onDraftVariants.has(beer.variant));

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Currently on Draft
          </h2>
          <p>
            Fresh from our taps at both locations - visit us to enjoy these beers today
          </p>
        </div>

        <div className="mb-8">
          <LocationTabs />
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
  const featuredEvents = events.filter(event => event.featured).slice(0, 3);

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {featuredEvents.map((event) => (
            <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <Badge variant="secondary" className="mb-2">
                    {event.type.replace('_', ' ')}
                  </Badge>
                  {event.featured && (
                    <Star className="h-5 w-5 text-yellow-500 fill-current" />
                  )}
                </div>

                <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
                <p className="text-muted-foreground mb-4 line-clamp-2">
                  {event.description}
                </p>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(event.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{event.location}</span>
                  </div>
                  {event.attendees && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{event.attendees} attending</span>
                    </div>
                  )}
                </div>

                {event.price && (
                  <div className="mt-4 pt-4 border-t">
                    <span className="font-semibold text-primary">{event.price}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

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
