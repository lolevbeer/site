import React from 'react';
import dynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { HomeContent } from '@/components/home/home-content';
import { MarketingText } from '@/components/home/marketing-text';
import { getHomePageData } from '@/lib/utils/homepage-data';
import { JsonLd } from '@/components/seo/json-ld';
import { PageTransition } from '@/components/motion';
import { createLocationLookup, generateEventJsonLd, generateFoodEventJsonLd } from '@/lib/utils/json-ld';
import { generateLocalBusinessSchemas, generateOrganizationSchema, generateWebSiteSchema } from '@/lib/utils/local-business-schema';
import { generateLocationMenuSchema } from '@/lib/utils/menu-schema';
import { extractBeerFromMenuItem } from '@/lib/utils/menu-item-utils';
import { getSiteSeo, siteDefaults } from '@/lib/utils/site-seo'
import { getAllLocations } from '@/lib/utils/payload-api'
import { buildPageMetadata } from '@/lib/seo/resolve-metadata'
import { selectHeroBeers, toHomeMenu } from '@/lib/utils/public-client-payloads'
import { buildMarketingCopy } from '@/lib/utils/marketing-copy'
import type { Menu } from '@/src/payload-types'

// ISR: Revalidate every 5 minutes as fallback (on-demand revalidation handles immediate updates)
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [locations, siteSeo] = await Promise.all([getAllLocations(), getSiteSeo()])
  const defaults = siteDefaults(siteSeo, locations)
  return buildPageMetadata({
    fallbackTitle: defaults.title,
    fallbackDescription: defaults.description,
    canonicalPath: '/',
    hubKey: 'home',
    absoluteTitle: true,
  })
}

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

  const locationLookup = createLocationLookup(data.locations);
  const localBusinessSchemas = generateLocalBusinessSchemas(data.locations, data.weeklyHours);
  const organizationSchema = generateOrganizationSchema(data.locations);
  const webSiteSchema = generateWebSiteSchema();
  const beersFrom = (menu: Menu | null) =>
    (menu?.items ?? [])
      .map((item) => extractBeerFromMenuItem(item))
      .filter((beer): beer is NonNullable<typeof beer> => beer !== null);
  const menuSchemas = data.locations
    .filter((loc) => loc.slug)
    .map((loc) => {
      const slug = loc.slug as string;
      return generateLocationMenuSchema({
        locationName: loc.name,
        locationSlug: slug,
        draftBeers: beersFrom(data.draftMenusByLocation[slug]),
        canBeers: beersFrom(data.cansMenusByLocation[slug]),
      });
    });
  const eventSchemas = data.allEvents.map((event) => generateEventJsonLd(event, locationLookup));
  const foodSchemas = data.allFood.map((food) => generateFoodEventJsonLd(food, locationLookup));

  // Client components get trimmed menus and beers (see public-client-payloads);
  // the JSON-LD above keeps the full docs. Each menu is projected once and the
  // same object is reused across props so the RSC payload can share it.
  const projectMenus = (byLocation: Record<string, Menu | null>) =>
    Object.fromEntries(
      Object.entries(byLocation).map(([slug, menu]) => [slug, menu && toHomeMenu(menu)]),
    );
  const homeDraftMenusByLocation = projectMenus(data.draftMenusByLocation);
  const homeCansMenusByLocation = projectMenus(data.cansMenusByLocation);
  const homeDraftMenus = Object.values(homeDraftMenusByLocation).filter((m): m is Menu => m !== null);
  const homeCansMenus = Object.values(homeCansMenusByLocation).filter((m): m is Menu => m !== null);
  const heroBeers = selectHeroBeers(data.availableBeers, homeCansMenus);

  return (
    <>
      {/* JSON-LD structured data for SEO */}
      {localBusinessSchemas.map((schema, index) => (
        <JsonLd key={`local-business-${index}`} data={schema} />
      ))}
      <JsonLd data={organizationSchema} />
      <JsonLd data={webSiteSchema} />
      {menuSchemas.map((schema, index) => (
        <JsonLd key={`menu-${index}`} data={schema} />
      ))}
      {eventSchemas.map((schema, index) => (
        <JsonLd key={`event-${index}`} data={schema} />
      ))}
      {foodSchemas.map((schema, index) => (
        <JsonLd key={`food-${index}`} data={schema} />
      ))}

      <PageTransition>
        {/* Staff-only #marketing view; its text is built here so the client gets strings, not menus. */}
        <MarketingText
          copy={buildMarketingCopy({
            locations: data.locations,
            draftMenusByLocation: data.draftMenusByLocation,
            cansMenusByLocation: data.cansMenusByLocation,
            eventsByLocation: data.eventsMarketingByLocation,
            foodByLocation: data.foodMarketingByLocation,
            comingSoonBeers: data.comingSoonBeers,
          })}
        />

        <HomeContent
          heroBeers={heroBeers}
          draftMenus={homeDraftMenus}
          beerCount={data.beerCount}
          cansCount={data.cansCount}
          nextEvent={data.nextEvent}
          heroDescription={data.siteContent.heroDescription}
          heroImageUrl={data.siteContent.heroImageUrl}
          weeklyHours={data.weeklyHours}
        >
          <FeaturedCans menus={homeCansMenus} />

          <UpcomingFood foodByLocation={data.foodByLocation} />

          <UpcomingEvents eventsByLocation={data.eventsByLocation} />

          <UpcomingBeers comingSoonBeers={data.comingSoonBeers} />
        </HomeContent>
      </PageTransition>
    </>
  );
}
