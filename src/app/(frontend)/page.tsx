import React from 'react';
import dynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { HomeContent } from '@/components/home/home-content';
import { MarketingText } from '@/components/home/marketing-text';
import { getHomePageData } from '@/lib/utils/homepage-data';
import { JsonLd } from '@/components/seo/json-ld';
import { generateEventJsonLd, generateFoodEventJsonLd } from '@/lib/utils/json-ld';
import { generateLocalBusinessSchemas, generateOrganizationSchema, generateWebSiteSchema } from '@/lib/utils/local-business-schema';
import { generateFullMenuSchema } from '@/lib/utils/menu-schema';

// ISR: Revalidate every 5 minutes as fallback (on-demand revalidation handles immediate updates)
export const revalidate = 300;

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

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

export default async function Home(): Promise<React.ReactElement> {
  const data = await getHomePageData();

  // Generate SEO schemas
  const localBusinessSchemas = generateLocalBusinessSchemas(data.locations);
  const organizationSchema = generateOrganizationSchema();
  const webSiteSchema = generateWebSiteSchema();
  const menuSchema = generateFullMenuSchema(data.availableBeers);
  const eventSchemas = data.allEvents.map(event => generateEventJsonLd(event));
  const foodSchemas = data.allFood.map(food => generateFoodEventJsonLd(food));

  return (
    <>
      {/* JSON-LD structured data for SEO */}
      {localBusinessSchemas.map((schema, index) => (
        <JsonLd key={`local-business-${index}`} data={schema} />
      ))}
      <JsonLd data={organizationSchema} />
      <JsonLd data={webSiteSchema} />
      <JsonLd data={menuSchema} />
      {eventSchemas.map((schema, index) => (
        <JsonLd key={`event-${index}`} data={schema} />
      ))}
      {foodSchemas.map((schema, index) => (
        <JsonLd key={`food-${index}`} data={schema} />
      ))}

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
        cansMenus={data.allCansMenus}
        beerCount={data.beerCount}
        nextEvent={data.nextEvent}
        heroDescription={data.siteContent.heroDescription}
        heroImageUrl={data.siteContent.heroImageUrl}
        weeklyHours={data.weeklyHours}
      >
        <FeaturedCans menus={data.allCansMenus} />

        <UpcomingFood foodByLocation={data.foodByLocation} />

        <UpcomingEvents eventsByLocation={data.eventsByLocation} />

        <UpcomingBeers comingSoonBeers={data.comingSoonBeers} />
      </HomeContent>
    </>
  );
}
