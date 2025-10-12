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
  type?: string;
  description?: string;
  title?: string;
}

import { parseTimeRange, parseLocalDate } from '@/lib/utils/formatters';

/**
 * Parse a single CSV row into a BreweryEvent
 */
function parseEventRow(row: EventCSVRow, location: Location): BreweryEvent | null {
  // Skip invalid or empty rows
  if (!row.date || !row.vendor) return null;

  // Validate date format (YYYY-MM-DD)
  const [year, month, day] = row.date.split('-').map(Number);
  if (!year || !month || !day) return null;
  const eventDate = new Date(year, month - 1, day);
  if (isNaN(eventDate.getTime())) return null;

  // Parse time
  const { time, endTime } = parseTimeRange(row.time);

  // Generate simple ID from date and vendor
  const dateStr = row.date.replace(/[^0-9]/g, '');
  const vendorStr = row.vendor.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
  const locStr = location === Location.LAWRENCEVILLE ? 'lv' : 'zel';
  const id = `${locStr}-${dateStr}-${vendorStr}`;

  // Use type from CSV or default to SPECIAL_EVENT
  const type = (row.type as EventType) || EventType.SPECIAL_EVENT;

  // Create event object
  const event: BreweryEvent = {
    id,
    title: row.title || row.vendor,
    description: row.description || row.vendor,
    date: row.date,
    time,
    vendor: row.vendor,
    type,
    status: EventStatus.SCHEDULED,
    location
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
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    return allEvents
      .filter(event => {
        const eventDate = parseLocalDate(event.date);
        return eventDate >= thirtyDaysAgo;
      })
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
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