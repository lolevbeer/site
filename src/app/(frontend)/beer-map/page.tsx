/**
 * Beer Map Page
 * Interactive map showing brewery locations
 */

import { Metadata } from 'next';
import { BeerMapContent } from '@/components/beer/beer-map-content';
import { getAllLocations, getWeeklyHoursWithHolidays, type WeeklyHoursDay } from '@/lib/utils/payload-api';

export const metadata: Metadata = {
  title: 'Find Us | Love of Lev Brewery',
  description: 'Find Love of Lev Brewery locations in Lawrenceville and Zelienople. Get directions, hours, and contact information for both brewery locations.',
  keywords: ['brewery locations', 'Pittsburgh brewery', 'Lawrenceville brewery', 'Zelienople brewery', 'find us', 'brewery map', 'directions'],
  openGraph: {
    title: 'Find Us | Love of Lev Brewery',
    description: 'Visit us at our Lawrenceville or Zelienople locations',
    type: 'website',
  }
};

export default async function BeerMapPage() {
  // Fetch locations and weekly hours
  const locations = await getAllLocations();
  const weeklyHoursEntries = await Promise.all(
    locations.map(async (location) => {
      const hours = await getWeeklyHoursWithHolidays(location.id);
      return [location.slug, hours] as [string, WeeklyHoursDay[]];
    })
  );
  const weeklyHours: Record<string, WeeklyHoursDay[]> = Object.fromEntries(weeklyHoursEntries);

  return <BeerMapContent weeklyHours={weeklyHours} />;
}