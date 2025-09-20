/**
 * Events utility functions for loading and parsing events from CSV
 */

import { Location } from '@/lib/types/location';
import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event';
import { fetchCSV } from './csv';

export interface EventCSVRow {
  date: string;
  vendor: string;
  time: string;
  attendees: string;
  site: string;
  end: string;
}

// Helper function to determine event type from vendor/title
function getEventType(vendor: string): EventType {
  const v = vendor.toLowerCase();
  if (v.includes('trivia')) return EventType.TRIVIA;
  if (v.includes('music') || v.includes('band') || v.includes('acoustic')) return EventType.LIVE_MUSIC;
  if (v.includes('comedy') || v.includes('stand up') || v.includes('standup')) return EventType.SPECIAL;
  if (v.includes('market') || v.includes('pop up')) return EventType.SPECIAL;
  if (v.includes('karaoke')) return EventType.SPECIAL;
  if (v.includes('open mic')) return EventType.LIVE_MUSIC;
  if (v.includes('tour')) return EventType.BREWERY_TOUR;
  if (v.includes('taco')) return EventType.FOOD_TRUCK;
  if (v.includes('ukulele') || v.includes('ukelele')) return EventType.LIVE_MUSIC;
  if (v.includes('run club') || v.includes('yoga') || v.includes('cycle')) return EventType.SPECIAL;
  if (v.includes('game') || v.includes('dungeons')) return EventType.TRIVIA;
  if (v.includes('dating') || v.includes('singles')) return EventType.SPECIAL;
  if (v.includes('fest') || v.includes('festival') || v.includes('oktoberfest')) return EventType.SPECIAL;
  return EventType.SPECIAL;
}

// Helper to parse time string
function parseTime(timeStr: string): { time: string; endTime?: string } {
  if (!timeStr) return { time: '7:00 PM' };

  // Handle ranges like "6-9pm" or "7:30-9pm"
  if (timeStr.includes('-')) {
    const parts = timeStr.split('-');
    let startTime = parts[0].trim();
    let endTime = parts[1].trim();

    // Add PM/AM if missing from start time but present in end time
    if (!startTime.toLowerCase().includes('am') && !startTime.toLowerCase().includes('pm')) {
      if (endTime.toLowerCase().includes('pm')) startTime += 'pm';
      else if (endTime.toLowerCase().includes('am')) startTime += 'am';
    }

    return {
      time: formatTimeDisplay(startTime),
      endTime: formatTimeDisplay(endTime)
    };
  }

  return { time: formatTimeDisplay(timeStr) };
}

function formatTimeDisplay(time: string): string {
  // Handle special cases
  if (time.includes(':')) {
    // Already has colon, just format case
    return time
      .replace(/pm/i, ' PM')
      .replace(/am/i, ' AM')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Add colon for times like "6pm" -> "6:00 PM"
  return time
    .replace(/(\d+)(am|pm)/i, '$1:00 $2')
    .replace(/pm/i, 'PM')
    .replace(/am/i, 'AM')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a unique event ID from date and vendor
 */
function generateEventId(date: string, vendor: string, location: Location): string {
  const dateStr = date.replace(/[^0-9]/g, '');
  const vendorStr = vendor.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
  const locStr = location === Location.LAWRENCEVILLE ? 'lv' : 'zel';
  return `${locStr}-${dateStr}-${vendorStr}`;
}

/**
 * Create a description from vendor name
 */
function createDescription(vendor: string, type: EventType): string {
  const baseDesc = vendor;

  switch (type) {
    case EventType.TRIVIA:
      return `Join us for ${baseDesc}. Test your knowledge and win prizes!`;
    case EventType.LIVE_MUSIC:
      return `Live performance by ${baseDesc}. Enjoy great music with your favorite beer!`;
    case EventType.FOOD_TRUCK:
      return `${baseDesc} will be serving delicious food. Perfect pairing with our craft beers!`;
    case EventType.SPECIAL:
      return `Special event: ${baseDesc}`;
    case EventType.BREWERY_TOUR:
      return `${baseDesc}. Take a behind-the-scenes look at our brewing process.`;
    default:
      return baseDesc;
  }
}

/**
 * Generate tags based on event type and vendor
 */
function generateTags(vendor: string, type: EventType): string[] {
  const tags: string[] = [];
  const v = vendor.toLowerCase();

  // Add type-based tags
  switch (type) {
    case EventType.TRIVIA:
      tags.push('trivia', 'fun', 'prizes');
      break;
    case EventType.LIVE_MUSIC:
      tags.push('music', 'live', 'entertainment');
      break;
    case EventType.FOOD_TRUCK:
      tags.push('food', 'dining');
      break;
    case EventType.SPECIAL:
      tags.push('special');
      break;
    case EventType.BREWERY_TOUR:
      tags.push('tour', 'educational');
      break;
  }

  // Add specific tags based on vendor
  if (v.includes('weekly') || v.includes('tuesday') || v.includes('wednesday')) {
    tags.push('weekly');
  }
  if (v.includes('local')) {
    tags.push('local');
  }
  if (v.includes('acoustic')) {
    tags.push('acoustic');
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Parse a single CSV row into a BreweryEvent
 */
function parseEventRow(row: EventCSVRow, location: Location): BreweryEvent | null {
  // Skip invalid or empty rows
  if (!row.date || !row.vendor) return null;

  // Parse date
  const eventDate = new Date(row.date);
  if (isNaN(eventDate.getTime())) return null;

  // Parse time
  const { time, endTime } = parseTime(row.time);

  // Determine event type
  const type = getEventType(row.vendor);

  // Create event object
  const event: BreweryEvent = {
    id: generateEventId(row.date, row.vendor, location),
    title: row.vendor,
    description: createDescription(row.vendor, type),
    date: eventDate.toISOString(),
    time,
    vendor: row.vendor,
    type,
    status: EventStatus.SCHEDULED,
    location,
    tags: generateTags(row.vendor, type)
  };

  // Add optional fields
  if (endTime) {
    event.endTime = endTime;
  }

  if (row.attendees && !isNaN(Number(row.attendees))) {
    event.attendees = Number(row.attendees);
  }

  if (row.site) {
    event.site = row.site;
  }

  // Mark some events as featured based on type or attendance
  if (type === EventType.SPECIAL || (event.attendees && event.attendees > 100)) {
    event.featured = true;
  }

  return event;
}

/**
 * Load events from CSV files
 */
export async function loadEventsFromCSV(): Promise<BreweryEvent[]> {
  try {
    const [lawrencevilleEvents, zelienopleEvents] = await Promise.all([
      fetchCSV<EventCSVRow>('lawrenceville-events.csv'),
      fetchCSV<EventCSVRow>('zelienople-events.csv')
    ]);

    // Parse Lawrenceville events
    const lvEvents = lawrencevilleEvents
      .map(row => parseEventRow(row, Location.LAWRENCEVILLE))
      .filter((event): event is BreweryEvent => event !== null);

    // Parse Zelienople events
    const zelEvents = zelienopleEvents
      .map(row => parseEventRow(row, Location.ZELIENOPLE))
      .filter((event): event is BreweryEvent => event !== null);

    // Combine all events
    const allEvents = [...lvEvents, ...zelEvents];

    // Filter to show only future events or recent past events (within 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return allEvents
      .filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= thirtyDaysAgo;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error) {
    console.error('Error loading events from CSV:', error);
    return [];
  }
}

/**
 * Get events for a specific location
 */
export async function getLocationEvents(location: Location): Promise<BreweryEvent[]> {
  const allEvents = await loadEventsFromCSV();
  return allEvents.filter(event => event.location === location);
}