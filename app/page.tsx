import React from 'react';
import dynamic from 'next/dynamic';
import { HomeContent } from '@/components/home/home-content';
import { FeaturedBeers } from '@/components/home/featured-beers';
import { MarketingText } from '@/components/home/marketing-text';
import {
  getAvailableBeers,
  getDraftBeers,
  getEnrichedCans,
  getUpcomingEvents,
  getUpcomingFood,
  getUpcomingBeers,
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

function LocationsSection({ beerCount }: { beerCount?: { lawrenceville: number; zelienople: number } }) {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Our Locations
          </h2>
        </div>

        <LocationCards beerCount={beerCount} />
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
    upcomingBeersData,
    // Marketing data with more results
    lawrencevilleEventsMarketing,
    zelienopleEventsMarketing,
    lawrencevilleFoodMarketing,
    zelienopleFoodMarketing,
  ] = await Promise.all([
    getAvailableBeers(),
    getDraftBeers('lawrenceville'),
    getDraftBeers('zelienople'),
    getEnrichedCans('lawrenceville'),
    getEnrichedCans('zelienople'),
    getUpcomingEvents('lawrenceville', 3),
    getUpcomingEvents('zelienople', 3),
    getUpcomingFood('lawrenceville', 3),
    getUpcomingFood('zelienople', 3),
    getUpcomingBeers(),
    // Fetch 10 items for marketing view
    getUpcomingEvents('lawrenceville', 10),
    getUpcomingEvents('zelienople', 10),
    getUpcomingFood('lawrenceville', 10),
    getUpcomingFood('zelienople', 10),
  ]);

  // Generate LocalBusiness and Organization schemas
  const localBusinessSchemas = generateAllLocalBusinessSchemas();
  const organizationSchema = generateOrganizationSchema();

  // Generate Event JSON-LD for upcoming events and food
  const allEvents = [...lawrencevilleEvents, ...zelienopleEvents];
  const allFood = [...lawrencevilleFood, ...zelienopleFood];
  const eventSchemas = allEvents.map(event => generateEventJsonLd(event));
  const foodSchemas = allFood.map(food => generateFoodEventJsonLd(food));

  // Prepare data for quick info cards
  const nextEvent = allEvents.length > 0 ? {
    name: allEvents[0].vendor,
    date: allEvents[0].date,
    location: allEvents[0].location
  } : null;

  const beerCount = {
    lawrenceville: lawrencevilleBeers.length,
    zelienople: zelienopleBeers.length
  };

  return (
    <>
      {/* Add JSON-LD structured data for SEO */}
      {/* LocalBusiness schemas for both brewery locations */}
      {localBusinessSchemas.map((schema, index) => (
        <JsonLd key={`local-business-${index}`} data={schema} />
      ))}
      {/* Organization schema */}
      <JsonLd data={organizationSchema} />
      {/* Event schemas */}
      {eventSchemas.map((schema, index) => (
        <JsonLd key={`event-${index}`} data={schema} />
      ))}
      {/* Food event schemas */}
      {foodSchemas.map((schema, index) => (
        <JsonLd key={`food-${index}`} data={schema} />
      ))}

      {/* Marketing Text Overlay */}
      <MarketingText
        lawrencevilleBeers={lawrencevilleBeers}
        zelienopleBeers={zelienopleBeers}
        lawrencevilleCans={lawrencevilleCans}
        zelienopleCans={zelienopleCans}
        lawrencevilleEvents={lawrencevilleEventsMarketing}
        zelienopleEvents={zelienopleEventsMarketing}
        lawrencevilleFood={lawrencevilleFoodMarketing}
        zelienopleFood={zelienopleFoodMarketing}
        upcomingBeers={upcomingBeersData}
      />

      <HomeContent
        availableBeers={availableBeers}
        lawrencevilleBeers={lawrencevilleBeers}
        zelienopleBeers={zelienopleBeers}
        lawrencevilleCans={lawrencevilleCans}
        zelienopleCans={zelienopleCans}
        beerCount={beerCount}
        nextEvent={nextEvent}
      >
        <div className="py-8 md:py-12" />

        <FeaturedCans
          lawrencevilleCans={lawrencevilleCans}
          zelienopleCans={zelienopleCans}
        />

        <div className="py-8 md:py-12" />

        <UpcomingFood
          lawrencevilleFood={lawrencevilleFood}
          zelienopleFood={zelienopleFood}
        />

        <div className="py-8 md:py-12" />

        <UpcomingEvents
          lawrencevilleEvents={lawrencevilleEvents}
          zelienopleEvents={zelienopleEvents}
        />

        <div className="py-8 md:py-12" />

        <UpcomingBeers />

        <div className="py-8 md:py-12" />

        <LocationsSection beerCount={beerCount} />
      </HomeContent>
    </>
  );
}
