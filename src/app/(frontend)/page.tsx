import React from 'react';
import dynamic from 'next/dynamic';
import { HomeContent } from '@/components/home/home-content';
import { MarketingText } from '@/components/home/marketing-text';
import { Spacer } from '@/components/ui/spacer';
import { getHomePageData } from '@/lib/utils/homepage-data';
import { JsonLd } from '@/components/seo/json-ld';
import { generateEventJsonLd, generateFoodEventJsonLd } from '@/lib/utils/json-ld';
import { generateLocalBusinessSchemas, generateOrganizationSchema } from '@/lib/utils/local-business-schema';

// Lazy load below-the-fold components
const FeaturedCans = dynamic(() => import('@/components/home/featured-menu').then(mod => ({ default: mod.FeaturedCans })), {
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


export default async function Home() {
  // Fetch all homepage data in a single consolidated operation
  const data = await getHomePageData();

  // Generate schemas for SEO
  const localBusinessSchemas = generateLocalBusinessSchemas(data.locations);
  const organizationSchema = generateOrganizationSchema();
  const eventSchemas = data.allEvents.map(event => generateEventJsonLd(event));
  const foodSchemas = data.allFood.map(food => generateFoodEventJsonLd(food));

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
        draftMenusByLocation={data.draftMenusByLocation}
        cansMenusByLocation={data.cansMenusByLocation}
        eventsByLocation={data.eventsMarketingByLocation}
        foodByLocation={data.foodMarketingByLocation}
        comingSoonBeers={data.comingSoonBeers}
      />

      <HomeContent
        availableBeers={data.availableBeers}
        draftMenus={data.allDraftMenus}
        beerCount={data.beerCount}
        nextEvent={data.nextEvent}
        isAuthenticated={data.authenticated}
        heroDescription={data.siteContent.heroDescription}
        heroImageUrl={data.siteContent.heroImageUrl}
        weeklyHours={data.weeklyHours}
      >
        <Spacer />

        <FeaturedCans
          menus={data.allCansMenus}
          isAuthenticated={data.authenticated}
        />

        <Spacer />

        <UpcomingFood
          foodByLocation={data.foodByLocation}
          isAuthenticated={data.authenticated}
        />

        <Spacer />

        <UpcomingEvents
          eventsByLocation={data.eventsByLocation}
          isAuthenticated={data.authenticated}
        />

        <Spacer />

        <UpcomingBeers comingSoonBeers={data.comingSoonBeers} isAuthenticated={data.authenticated} />
      </HomeContent>
    </>
  );
}
