/**
 * RSS Feed for Lolev Beer
 * Provides updates on new beers and upcoming events
 * Helps with content distribution and aggregator visibility
 */

import { NextResponse } from 'next/server';
import { getAllBeersFromPayload, getUpcomingEvents, getUpcomingFood } from '@/lib/utils/payload-api';

export const revalidate = 3600; // Revalidate every hour

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRFC822Date(date: Date): string {
  return date.toUTCString();
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lolev.beer';

  // Fetch content
  let beers: Awaited<ReturnType<typeof getAllBeersFromPayload>> = [];
  let events: Awaited<ReturnType<typeof getUpcomingEvents>> = [];
  let food: Awaited<ReturnType<typeof getUpcomingFood>> = [];

  try {
    beers = await getAllBeersFromPayload();
  } catch (error) {
    console.error('Error fetching beers for RSS:', error);
  }

  try {
    events = await getUpcomingEvents();
  } catch (error) {
    console.error('Error fetching events for RSS:', error);
  }

  try {
    food = await getUpcomingFood();
  } catch (error) {
    console.error('Error fetching food for RSS:', error);
  }

  // Filter to visible beers and sort by recipe number (newest first)
  const visibleBeers = beers
    .filter(beer => !beer.hideFromSite && beer.name)
    .sort((a, b) => (b.recipe || 0) - (a.recipe || 0))
    .slice(0, 20); // Latest 20 beers

  // Build RSS items
  const items: string[] = [];

  // Add beer items
  for (const beer of visibleBeers) {
    const styleName = typeof beer.style === 'object' ? beer.style?.name : beer.style || 'Beer';
    const pubDate = formatRFC822Date(new Date()); // Use current date as we don't track beer creation date

    items.push(`
    <item>
      <title>${escapeXml(beer.name)}</title>
      <link>${baseUrl}/beer/${beer.slug}</link>
      <description>${escapeXml(beer.description || `${styleName} - ${beer.abv}% ABV`)}</description>
      <category>Beer</category>
      <category>${escapeXml(styleName)}</category>
      <guid isPermaLink="true">${baseUrl}/beer/${beer.slug}</guid>
      <pubDate>${pubDate}</pubDate>
    </item>`);
  }

  // Add event items
  for (const event of events.slice(0, 10)) {
    const eventDate = new Date(event.date);
    const title = event.organizer || 'Event at Lolev Beer';

    items.push(`
    <item>
      <title>${escapeXml(title)}</title>
      <link>${baseUrl}/events</link>
      <description>${escapeXml(event.description || `${title} on ${eventDate.toLocaleDateString()}`)}</description>
      <category>Event</category>
      <guid isPermaLink="false">event-${event.id || event.date}</guid>
      <pubDate>${formatRFC822Date(eventDate)}</pubDate>
    </item>`);
  }

  // Add food vendor items
  for (const vendor of food.slice(0, 10)) {
    const vendorDate = new Date(vendor.date);
    const vendorName = typeof vendor.vendor === 'object' ? vendor.vendor?.name : vendor.vendorName || 'Food Vendor';

    items.push(`
    <item>
      <title>${escapeXml(vendorName || 'Food')} at Lolev Beer</title>
      <link>${baseUrl}/food</link>
      <description>${escapeXml(`${vendorName} serving food at Lolev Beer on ${vendorDate.toLocaleDateString()}`)}</description>
      <category>Food</category>
      <guid isPermaLink="false">food-${vendor.id || vendor.date}</guid>
      <pubDate>${formatRFC822Date(vendorDate)}</pubDate>
    </item>`);
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Lolev Beer</title>
    <link>${baseUrl}</link>
    <description>Craft brewery in Pittsburgh, Pennsylvania. Updates on new beers, events, and food vendors.</description>
    <language>en-us</language>
    <lastBuildDate>${formatRFC822Date(new Date())}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${baseUrl}/images/og-image.png</url>
      <title>Lolev Beer</title>
      <link>${baseUrl}</link>
    </image>
    ${items.join('\n')}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
