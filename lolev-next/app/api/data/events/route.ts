/**
 * Events data API endpoint
 * Provides event list with filtering, sorting, and location-specific data
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  sampleEvents,
  getUpcomingEvents,
  getSampleDataByLocation
} from '@/lib/data/sample-data';
import {
  APIResponse,
  EventList,
  EventFilters,
  EventSortOptions,
  Location,
  EventType,
  EventStatus
} from '@/lib/types';

// Enable ISR revalidation every 15 minutes
export const revalidate = 900;

/**
 * GET /api/data/events
 * Returns filtered and sorted event list
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const location = searchParams.get('location') as Location | null;
    const type = searchParams.get('type') as EventType | null;
    const status = searchParams.get('status') as EventStatus | null;
    const search = searchParams.get('search');
    const featuredOnly = searchParams.get('featured') === 'true';
    const freeOnly = searchParams.get('free') === 'true';
    const sortBy = searchParams.get('sortBy') as 'date' | 'title' | 'type' | 'attendees' | null;
    const order = searchParams.get('order') as 'asc' | 'desc' | null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const upcoming = searchParams.get('upcoming') === 'true';

    // Date range filtering
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get base data
    let events = upcoming ? getUpcomingEvents(location) : [...sampleEvents];

    // Apply location filter
    if (location && !upcoming) {
      events = events.filter(event => event.location === location);
    }

    // Apply filters
    const filters: EventFilters = {};

    if (location) {
      filters.location = location;
    }

    if (type) {
      filters.type = [type];
      events = events.filter(event => event.type === type);
    }

    if (status) {
      filters.status = [status];
      events = events.filter(event => event.status === status);
    }

    if (featuredOnly) {
      filters.featuredOnly = true;
      events = events.filter(event => event.featured === true);
    }

    if (freeOnly) {
      filters.freeOnly = true;
      events = events.filter(event =>
        !event.price ||
        event.price.toLowerCase() === 'free' ||
        event.price === '$0'
      );
    }

    if (search) {
      filters.search = search;
      const searchLower = search.toLowerCase();
      events = events.filter(event =>
        event.title.toLowerCase().includes(searchLower) ||
        (event.description && event.description.toLowerCase().includes(searchLower)) ||
        event.vendor.toLowerCase().includes(searchLower) ||
        (event.tags && event.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    // Date range filtering
    if (startDate || endDate) {
      filters.dateRange = {
        start: startDate || '',
        end: endDate || ''
      };

      events = events.filter(event => {
        const eventDate = new Date(event.date);

        if (startDate) {
          const start = new Date(startDate);
          if (eventDate < start) return false;
        }

        if (endDate) {
          const end = new Date(endDate);
          if (eventDate > end) return false;
        }

        return true;
      });
    }

    // Apply sorting
    const sortOptions: EventSortOptions = {
      sortBy: sortBy || 'date',
      order: order || 'asc'
    };

    events.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortOptions.sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'attendees':
          aValue = a.attendees || 0;
          bValue = b.attendees || 0;
          break;
        default:
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortOptions.order === 'desc' ? -comparison : comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue;
        return sortOptions.order === 'desc' ? -comparison : comparison;
      }

      return 0;
    });

    // Apply limit
    if (limit && limit > 0) {
      events = events.slice(0, limit);
    }

    // Prepare response
    const eventList: EventList = {
      events,
      total: events.length,
      filters,
      lastUpdated: new Date().toISOString(),
    };

    const response: APIResponse<EventList> = {
      data: eventList,
      success: true,
      message: `Found ${events.length} events`,
      timestamp: new Date().toISOString(),
    };

    // Set cache headers for ISR
    const nextResponse = NextResponse.json(response);
    nextResponse.headers.set('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

    return nextResponse;

  } catch (error) {
    console.error('Events API error:', error);

    const errorResponse: APIResponse = {
      data: null,
      success: false,
      error: 'Failed to fetch event data',
      message: 'An error occurred while retrieving event information',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Helper function to parse time range and calculate end time
 */
function parseEventTime(timeString: string) {
  // Parse strings like "7-9pm", "6-9pm", "4-10pm"
  const timePattern = /(\d+)(?::(\d+))?\s*-\s*(\d+)(?::(\d+))?\s*(am|pm)/i;
  const match = timeString.match(timePattern);

  if (match) {
    const [, startHour, startMin, endHour, endMin, period] = match;
    return {
      startTime: `${startHour}:${startMin || '00'}${period.toLowerCase()}`,
      endTime: `${endHour}:${endMin || '00'}${period.toLowerCase()}`,
    };
  }

  return {
    startTime: timeString,
    endTime: timeString,
  };
}

/**
 * GET /api/data/events/calendar
 * Returns events formatted for calendar view
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, month, location } = body;

    if (!year || !month) {
      return NextResponse.json({
        success: false,
        error: 'Year and month are required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // Get events for the specified month
    let events = location
      ? sampleEvents.filter(event => event.location === location)
      : sampleEvents;

    // Filter by month/year
    events = events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === year &&
             eventDate.getMonth() === month - 1; // month is 0-indexed in Date
    });

    // Group events by date
    const eventsByDate: Record<string, typeof events> = {};
    events.forEach(event => {
      const dateKey = event.date;
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);
    });

    const calendarData = {
      year,
      month,
      eventsByDate,
      totalEvents: events.length,
    };

    const response: APIResponse = {
      data: calendarData,
      success: true,
      message: `Found ${events.length} events for ${month}/${year}`,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Events calendar API error:', error);

    const errorResponse: APIResponse = {
      data: null,
      success: false,
      error: 'Failed to fetch calendar data',
      message: 'An error occurred while retrieving calendar information',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * OPTIONS method for CORS support
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}