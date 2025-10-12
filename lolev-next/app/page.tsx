import React from 'react';
import dynamic from 'next/dynamic';
import { HeroSection } from '@/components/home/hero-section';
import { FeaturedBeers } from '@/components/home/featured-beers';
import {
  getAvailableBeers,
  getDraftBeers,
  getEnrichedCans,
  getUpcomingEvents,
  getUpcomingFood,
} from '@/lib/data/beer-data';
import { JsonLd } from '@/components/seo/json-ld';
import { generateEventJsonLd, generateFoodEventJsonLd } from '@/lib/utils/json-ld';
import { generateAllLocalBusinessSchemas, generateOrganizationSchema } from '@/lib/utils/local-business-schema';

// Lazy load below-the-fold components
const FeaturedCans = dynamic(() => import('@/components/home/featured-cans').then(mod => ({ default: mod.FeaturedCans })), {
  loading: () => <div className="py-16 lg:py-24 bg-background h-96 animate-pulse" />,
});

const UpcomingBeers = dynamic(() => import('@/components/home/upcoming-beers').then(mod => ({ default: mod.UpcomingBeers })), {
  loading: () => <div className="py-16 lg:py-24 bg-background h-96 animate-pulse" />,
});

const UpcomingFood = dynamic(() => import('@/components/home/upcoming-food').then(mod => ({ default: mod.UpcomingFood })), {
  loading: () => <div className="py-16 lg:py-24 bg-background h-96 animate-pulse" />,
});

const UpcomingEvents = dynamic(() => import('@/components/home/upcoming-events').then(mod => ({ default: mod.UpcomingEvents })), {
  loading: () => <div className="py-16 lg:py-24 h-96 animate-pulse" />,
});

const LocationCards = dynamic(() => import('@/components/location/location-cards').then(mod => ({ default: mod.LocationCards })), {
  loading: () => <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse" />,
});

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

export default async function Home() {
  // Fetch all data in parallel on the server
  const [
    availableBeers,
    lawrencevilleBeers,
    zelienopleBeers,
    lawrencevilleCans,
    zelienopleCans,
    lawrencevilleEvents,
    zelienopleEvents,
    lawrencevilleFood,
    zelienopleFood,
  ] = await Promise.all([
    getAvailableBeers(),
    getDraftBeers('lawrenceville'),
    getDraftBeers('zelienople'),
    getEnrichedCans('lawrenceville'),
    getEnrichedCans('zelienople'),
    getUpcomingEvents('lawrenceville'),
    getUpcomingEvents('zelienople'),
    getUpcomingFood('lawrenceville'),
    getUpcomingFood('zelienople'),
  ]);

  // Combine all events and food for JSON-LD
  const allEvents = [...lawrencevilleEvents, ...zelienopleEvents];
  const allFood = [...lawrencevilleFood, ...zelienopleFood];

  // Filter out invalid events and food before generating JSON-LD
  const validEvents = allEvents.filter(event => event && event.title && event.date && event.location);
  const validFood = allFood.filter(food => food && food.vendor && food.date && food.location);

  // Generate JSON-LD for upcoming events and food
  const eventsJsonLd = validEvents.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: validEvents.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: generateEventJsonLd(event)
    }))
  } : null;

  const foodJsonLd = validFood.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: validFood.map((food, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: generateFoodEventJsonLd(food)
    }))
  } : null;

  // Generate LocalBusiness and Organization schemas
  const localBusinessSchemas = generateAllLocalBusinessSchemas();
  const organizationSchema = generateOrganizationSchema();

  return (
    <>
      {/* Add JSON-LD structured data for SEO */}
      {/* LocalBusiness schemas for both brewery locations */}
      {localBusinessSchemas.map((schema, index) => (
        <JsonLd key={`local-business-${index}`} data={schema} />
      ))}
      {/* Organization schema */}
      <JsonLd data={organizationSchema} />
      {/* Events and Food */}
      {eventsJsonLd && <JsonLd data={eventsJsonLd} />}
      {foodJsonLd && <JsonLd data={foodJsonLd} />}

      <div className="min-h-screen">
        <HeroSection availableBeers={availableBeers} />
        <FeaturedBeers
          lawrencevilleBeers={lawrencevilleBeers}
          zelienopleBeers={zelienopleBeers}
        />
        <FeaturedCans
          lawrencevilleCans={lawrencevilleCans}
          zelienopleCans={zelienopleCans}
        />
        <UpcomingFood
          lawrencevilleFood={lawrencevilleFood}
          zelienopleFood={zelienopleFood}
        />
        <UpcomingEvents
          lawrencevilleEvents={lawrencevilleEvents}
          zelienopleEvents={zelienopleEvents}
        />
        <UpcomingBeers />
        <LocationsSection />
      </div>
    </>
  );
}
