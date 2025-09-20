/**
 * Food vendor schedule API endpoint
 * Provides food truck/vendor schedules with filtering, sorting, and location-specific data
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  sampleFoodSchedule,
  getCurrentWeekFoodSchedule,
  getSampleDataByLocation,
  sampleVendors
} from '@/lib/data/sample-data';
import {
  APIResponse,
  FoodVendorList,
  FoodVendorFilters,
  FoodVendorSortOptions,
  WeeklyFoodSchedule,
  DailyFoodSchedule,
  Location,
  CuisineType,
  DayOfWeek,
  FoodVendorType,
  DietaryOption
} from '@/lib/types';

// Enable ISR revalidation every 15 minutes
export const revalidate = 900;

/**
 * GET /api/data/food
 * Returns filtered and sorted food vendor schedule list
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const location = searchParams.get('location') as Location | null;
    const cuisine = searchParams.get('cuisine') as CuisineType | null;
    const day = searchParams.get('day') as DayOfWeek | null;
    const vendorType = searchParams.get('vendorType') as FoodVendorType | null;
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') as 'name' | 'date' | 'rating' | 'priceRange' | null;
    const order = searchParams.get('order') as 'asc' | 'desc' | null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const currentWeek = searchParams.get('currentWeek') === 'true';
    const activeOnly = searchParams.get('activeOnly') !== 'false'; // Default to true

    // Date range filtering
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get base data
    let schedules = currentWeek
      ? getCurrentWeekFoodSchedule(location)
      : [...sampleFoodSchedule];

    // Apply location filter
    if (location && !currentWeek) {
      schedules = schedules.filter(schedule => schedule.location === location);
    }

    // Apply filters
    const filters: FoodVendorFilters = {};

    if (location) {
      filters.location = location;
    }

    if (day) {
      filters.daysOfWeek = [day];
      schedules = schedules.filter(schedule => schedule.day === day);
    }

    if (search) {
      filters.search = search;
      const searchLower = search.toLowerCase();
      schedules = schedules.filter(schedule =>
        schedule.vendor.toLowerCase().includes(searchLower) ||
        (schedule.notes && schedule.notes.toLowerCase().includes(searchLower))
      );
    }

    if (activeOnly) {
      filters.activeOnly = true;
      // Filter by active vendors (assuming all sample vendors are active)
      const activeVendorNames = sampleVendors
        .filter(vendor => vendor.active)
        .map(vendor => vendor.name);
      schedules = schedules.filter(schedule =>
        activeVendorNames.includes(schedule.vendor)
      );
    }

    // Date range filtering
    if (startDate || endDate) {
      filters.dateRange = {
        start: startDate || '',
        end: endDate || ''
      };

      schedules = schedules.filter(schedule => {
        const scheduleDate = new Date(schedule.date);

        if (startDate) {
          const start = new Date(startDate);
          if (scheduleDate < start) return false;
        }

        if (endDate) {
          const end = new Date(endDate);
          if (scheduleDate > end) return false;
        }

        return true;
      });
    }

    // Filter by cuisine type (requires vendor lookup)
    if (cuisine) {
      filters.cuisineTypes = [cuisine];
      const vendorsWithCuisine = sampleVendors
        .filter(vendor => vendor.cuisineTypes.includes(cuisine))
        .map(vendor => vendor.name);
      schedules = schedules.filter(schedule =>
        vendorsWithCuisine.includes(schedule.vendor)
      );
    }

    // Filter by vendor type (requires vendor lookup)
    if (vendorType) {
      filters.vendorType = [vendorType];
      const vendorsOfType = sampleVendors
        .filter(vendor => vendor.type === vendorType)
        .map(vendor => vendor.name);
      schedules = schedules.filter(schedule =>
        vendorsOfType.includes(schedule.vendor)
      );
    }

    // Apply sorting
    const sortOptions: FoodVendorSortOptions = {
      sortBy: sortBy || 'date',
      order: order || 'asc'
    };

    schedules.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortOptions.sortBy) {
        case 'name':
          aValue = a.vendor;
          bValue = b.vendor;
          break;
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'rating':
          // Look up vendor rating
          const aVendor = sampleVendors.find(v => v.name === a.vendor);
          const bVendor = sampleVendors.find(v => v.name === b.vendor);
          aValue = aVendor?.rating || 0;
          bValue = bVendor?.rating || 0;
          break;
        case 'priceRange':
          // Look up vendor price range
          const aVendorPrice = sampleVendors.find(v => v.name === a.vendor);
          const bVendorPrice = sampleVendors.find(v => v.name === b.vendor);
          aValue = aVendorPrice?.priceRange || 0;
          bValue = bVendorPrice?.priceRange || 0;
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
      schedules = schedules.slice(0, limit);
    }

    // Get unique vendors from the filtered schedules
    const uniqueVendorNames = [...new Set(schedules.map(s => s.vendor))];
    const vendors = sampleVendors.filter(vendor =>
      uniqueVendorNames.includes(vendor.name)
    );

    // Prepare response
    const foodVendorList: FoodVendorList = {
      schedules,
      vendors,
      total: schedules.length,
      filters,
      lastUpdated: new Date().toISOString(),
    };

    const response: APIResponse<FoodVendorList> = {
      data: foodVendorList,
      success: true,
      message: `Found ${schedules.length} food vendor schedules`,
      timestamp: new Date().toISOString(),
    };

    // Set cache headers for ISR
    const nextResponse = NextResponse.json(response);
    nextResponse.headers.set('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

    return nextResponse;

  } catch (error) {
    console.error('Food API error:', error);

    const errorResponse: APIResponse = {
      data: null,
      success: false,
      error: 'Failed to fetch food vendor data',
      message: 'An error occurred while retrieving food vendor information',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/data/food/weekly
 * Returns weekly food schedule formatted for calendar view
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location, weekStart } = body;

    // Calculate week dates
    const startDate = weekStart ? new Date(weekStart) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // Get schedules for the week
    let schedules = location
      ? sampleFoodSchedule.filter(schedule => schedule.location === location)
      : sampleFoodSchedule;

    // Filter by week
    schedules = schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      return scheduleDate >= startDate && scheduleDate <= endDate;
    });

    // Group by location and day
    const scheduleByLocation: Record<Location, DailyFoodSchedule[]> = {
      [Location.LAWRENCEVILLE]: [],
      [Location.ZELIENOPLE]: [],
    };

    // Group schedules by date first
    const schedulesByDate: Record<string, typeof schedules> = {};
    schedules.forEach(schedule => {
      const dateKey = schedule.date;
      if (!schedulesByDate[dateKey]) {
        schedulesByDate[dateKey] = [];
      }
      schedulesByDate[dateKey].push(schedule);
    });

    // Create daily schedules
    Object.entries(schedulesByDate).forEach(([date, daySchedules]) => {
      const schedulesByLoc = {
        [Location.LAWRENCEVILLE]: daySchedules.filter(s => s.location === Location.LAWRENCEVILLE),
        [Location.ZELIENOPLE]: daySchedules.filter(s => s.location === Location.ZELIENOPLE),
      };

      Object.entries(schedulesByLoc).forEach(([loc, vendors]) => {
        if (vendors.length > 0) {
          const dailySchedule: DailyFoodSchedule = {
            date,
            day: vendors[0].day,
            vendors,
            specialEvent: vendors.some(v => v.specialEvent),
          };
          scheduleByLocation[loc as Location].push(dailySchedule);
        }
      });
    });

    // Calculate week number
    const weekNumber = getWeekNumber(startDate);

    const weeklySchedule: WeeklyFoodSchedule = {
      weekStart: startDate.toISOString().split('T')[0],
      weekEnd: endDate.toISOString().split('T')[0],
      weekNumber,
      schedule: scheduleByLocation,
      totalVendors: schedules.length,
    };

    const response: APIResponse<WeeklyFoodSchedule> = {
      data: weeklySchedule,
      success: true,
      message: `Found ${schedules.length} vendor schedules for week ${weekNumber}`,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Weekly food schedule API error:', error);

    const errorResponse: APIResponse = {
      data: null,
      success: false,
      error: 'Failed to fetch weekly food schedule',
      message: 'An error occurred while retrieving weekly schedule information',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Helper function to get week number of the year
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Helper function to parse food vendor time strings
 */
function parseFoodTime(timeString: string) {
  // Parse strings like "4-9pm", "11am-3pm", "2-10pm"
  const timePattern = /(\d+)(?::(\d+))?\s*(am|pm)?\s*-\s*(\d+)(?::(\d+))?\s*(am|pm)/i;
  const match = timeString.match(timePattern);

  if (match) {
    const [, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = match;
    return {
      startTime: `${startHour}:${startMin || '00'}${startPeriod || endPeriod}`,
      endTime: `${endHour}:${endMin || '00'}${endPeriod}`,
    };
  }

  return {
    startTime: timeString.split('-')[0]?.trim() || timeString,
    endTime: timeString.split('-')[1]?.trim() || timeString,
  };
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