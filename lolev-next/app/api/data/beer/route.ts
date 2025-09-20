/**
 * Beer data API endpoint
 * Provides beer list with filtering, sorting, and location-specific data
 */

import { NextRequest, NextResponse } from 'next/server';
import { beers } from '@/lib/data/beer-data';
import {
  APIResponse,
  BeerList,
  BeerFilters,
  BeerSortOptions,
  Location,
  BeerStyle
} from '@/lib/types';

// Enable ISR revalidation every 15 minutes
export const revalidate = 900;

/**
 * GET /api/data/beer
 * Returns filtered and sorted beer list
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const location = searchParams.get('location') as Location | null;
    const style = searchParams.get('style') as BeerStyle | null;
    const availability = searchParams.get('availability') as 'draft' | 'cans' | 'all' | null;
    const glutenFree = searchParams.get('glutenFree') === 'true';
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') as 'name' | 'abv' | 'type' | 'tap' | null;
    const order = searchParams.get('order') as 'asc' | 'desc' | null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    // Get base data (location filtering doesn't apply to beers in this sample)
    let beersData = [...beers];

    // Apply filters
    const filters: BeerFilters = {};

    if (style) {
      filters.style = [style];
      beersData = beersData.filter(beer => beer.type === style);
    }

    if (availability) {
      filters.availability = availability;
      switch (availability) {
        case 'draft':
          beersData = beersData.filter(beer => beer.availability.tap);
          break;
        case 'cans':
          beersData = beersData.filter(beer => beer.availability.cansAvailable);
          break;
        case 'all':
        default:
          // No additional filtering
          break;
      }
    }

    if (glutenFree) {
      filters.glutenFree = true;
      beersData = beersData.filter(beer => beer.glutenFree);
    }

    if (search) {
      filters.search = search;
      const searchLower = search.toLowerCase();
      beersData = beersData.filter(beer =>
        beer.name.toLowerCase().includes(searchLower) ||
        beer.description.toLowerCase().includes(searchLower) ||
        beer.type.toLowerCase().includes(searchLower) ||
        (beer.hops && beer.hops.toLowerCase().includes(searchLower))
      );
    }

    // Filter out hidden beers
    beersData = beersData.filter(beer => !beer.availability.hideFromSite);

    // Apply sorting
    const sortOptions: BeerSortOptions = {
      sortBy: sortBy || 'name',
      order: order || 'asc'
    };

    beersData.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortOptions.sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'abv':
          aValue = a.abv;
          bValue = b.abv;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'tap':
          aValue = a.availability.tap || '999';
          bValue = b.availability.tap || '999';
          break;
        default:
          aValue = a.name;
          bValue = b.name;
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
      beersData = beersData.slice(0, limit);
    }

    // Prepare response
    const beerList: BeerList = {
      beers: beersData,
      total: beersData.length,
      lastUpdated: new Date().toISOString(),
    };

    const response: APIResponse<BeerList> = {
      data: beerList,
      success: true,
      message: `Found ${beersData.length} beers`,
      timestamp: new Date().toISOString(),
    };

    // Set cache headers for ISR
    const nextResponse = NextResponse.json(response);
    nextResponse.headers.set('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

    return nextResponse;

  } catch (error) {
    console.error('Beer API error:', error);

    const errorResponse: APIResponse = {
      data: null,
      success: false,
      error: 'Failed to fetch beer data',
      message: 'An error occurred while retrieving beer information',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * GET /api/data/beer/[variant] (for individual beer details)
 * This would be implemented in a dynamic route if needed
 */

/**
 * OPTIONS method for CORS support
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}