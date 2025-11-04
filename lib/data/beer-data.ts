/**
 * Server-side data fetching utilities for beer data
 * Fetches and parses CSV files with caching
 */

import { cache } from 'react';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '@/lib/utils/logger';
import { GlassType } from '@/lib/types/beer';
import { Location } from '@/lib/types/location';
import { parseCSV } from '@/lib/utils/csv';
import { compareDateStrings } from '@/lib/utils/date';
import { constants } from 'fs';

interface BeerRow {
  variant: string;
  name: string;
  type?: string;
  abv?: string;
  image?: string;
  hideFromSite?: string;
  recipe?: string;
  [key: string]: any;
}

interface DraftBeerRow {
  tap?: string;
  variant: string;
  name: string;
  type?: string;
  abv?: string;
  glass?: string;
  price?: string;
  description?: string;
  [key: string]: any;
}

interface CanRow {
  variant: string;
  name?: string;
  type?: string;
  abv?: string;
  [key: string]: any;
}

interface EventRow {
  date: string;
  vendor: string;
  time?: string;
  attendees?: string;
  site?: string;
  end?: string;
  [key: string]: any;
}

interface FoodRow {
  vendor: string;
  date: string;
  time?: string;
  site?: string;
  day?: string;
  [key: string]: any;
}

// Helper to read CSV from public directory
async function readCSV(filename: string): Promise<string> {
  const filePath = join(process.cwd(), 'public', 'data', filename);
  return await readFile(filePath, 'utf-8');
}

// Helper to check if a beer image exists
async function imageExists(variant: string): Promise<boolean> {
  const imagePath = join(process.cwd(), 'public', 'images', 'beer', `${variant}.webp`);
  try {
    await access(imagePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}


/**
 * Get all available beers (beers that are currently on tap or in cans)
 * Cached for deduplication across requests
 */
export const getAvailableBeers = cache(async (): Promise<{ variant: string; name: string }[]> => {
  try {
    const [lawrencevilleDraftText, zelienopleDraftText, lawrencevilleCansText, zelienopleCansText, beerText] = await Promise.all([
      readCSV('lawrenceville-draft.csv'),
      readCSV('zelienople-draft.csv'),
      readCSV('lawrenceville-cans.csv'),
      readCSV('zelienople-cans.csv'),
      readCSV('beer.csv')
    ]);

    const availableVariants = new Set<string>();

    // Parse draft CSVs
    const lawrencevilleDraft = parseCSV<DraftBeerRow>(lawrencevilleDraftText);
    const zelienopleDraft = parseCSV<DraftBeerRow>(zelienopleDraftText);

    lawrencevilleDraft.forEach(row => {
      if (row.variant) availableVariants.add(row.variant.toLowerCase());
    });
    zelienopleDraft.forEach(row => {
      if (row.variant) availableVariants.add(row.variant.toLowerCase());
    });

    // Parse cans CSVs
    const lawrencevilleCans = parseCSV<CanRow>(lawrencevilleCansText);
    const zelienopleCans = parseCSV<CanRow>(zelienopleCansText);

    lawrencevilleCans.forEach(row => {
      if (row.variant) availableVariants.add(row.variant.toLowerCase());
    });
    zelienopleCans.forEach(row => {
      if (row.variant) availableVariants.add(row.variant.toLowerCase());
    });

    // Parse beer.csv and filter for available beers with images
    const beerData = parseCSV<BeerRow>(beerText);

    // Filter for available beers that are not hidden
    const availableBeersData = beerData.filter(row =>
      row.variant &&
      availableVariants.has(row.variant.toLowerCase()) &&
      row.hideFromSite?.toString().toUpperCase() !== 'TRUE'
    );

    // Check which beers have actual image files and include recipe value
    const beersWithImagesPromises = availableBeersData.map(async (row) => {
      const hasImage = await imageExists(row.variant);
      return hasImage ? { variant: row.variant, name: row.name, recipe: parseInt(row.recipe || '0') } : null;
    });

    const beersWithImages = (await Promise.all(beersWithImagesPromises))
      .filter((beer): beer is { variant: string; name: string; recipe: number } => beer !== null);

    // Sort by recipe value descending (highest to lowest)
    beersWithImages.sort((a, b) => b.recipe - a.recipe);

    return beersWithImages;
  } catch (error) {
    logger.error('Error loading available beers', error);
    return [];
  }
});

/**
 * Get draft beers for a specific location
 * Cached for deduplication across requests
 */
export const getDraftBeers = cache(async (location: 'lawrenceville' | 'zelienople') => {
  try {
    const [draftText, cansText] = await Promise.all([
      readCSV(`${location}-draft.csv`),
      readCSV(`${location}-cans.csv`)
    ]);

    // Create cans availability set
    const cansData = parseCSV<CanRow>(cansText);
    const cansSet = new Set<string>();
    cansData.forEach(row => {
      if (row.variant) cansSet.add(row.variant.toLowerCase());
    });

    // Helper to convert glass string to GlassType
    const getGlassType = (glass?: string): GlassType => {
      if (!glass) return GlassType.PINT;
      const normalized = glass.toLowerCase();
      if (normalized === 'teku') return GlassType.TEKU;
      if (normalized === 'stein') return GlassType.STEIN;
      return GlassType.PINT;
    };

    // Parse draft beers
    const draftData = parseCSV<DraftBeerRow>(draftText);

    // Check which beers have images
    const beersPromises = draftData
      .filter(row => row.variant)
      .map(async (row) => {
        const hasImage = await imageExists(row.variant);
        return {
          variant: row.variant,
          name: row.name || '',
          type: row.type || '',
          abv: parseFloat(row.abv || '0'),
          glass: getGlassType(row.glass),
          description: row.description || '',
          image: hasImage,
          glutenFree: false,
          pricing: {
            draftPrice: row.price ? parseFloat(row.price) : undefined,
          },
          availability: {
            cansAvailable: cansSet.has(row.variant.toLowerCase()),
            tap: row.tap,
            hideFromSite: false,
          },
        };
      });

    const beers = await Promise.all(beersPromises);
    return beers;
  } catch (error) {
    logger.error(`Error loading draft beers for ${location}`, error);
    return [];
  }
});

/**
 * Get enriched can data for a specific location
 * Cached for deduplication across requests
 */
export const getEnrichedCans = cache(async (location: 'lawrenceville' | 'zelienople') => {
  try {
    const [cansText, beerText, draftText] = await Promise.all([
      readCSV(`${location}-cans.csv`),
      readCSV('beer.csv'),
      readCSV(`${location}-draft.csv`)
    ]);

    const cansData = parseCSV<CanRow>(cansText);
    const beerData = parseCSV<BeerRow>(beerText);
    const draftData = parseCSV<DraftBeerRow>(draftText);

    // Create a map of beer details
    const beerMap = new Map();
    beerData.forEach(row => {
      if (row.variant) {
        beerMap.set(row.variant.toLowerCase(), row);
      }
    });

    // Create a set of beers on draft
    const onDraftSet = new Set<string>();
    draftData.forEach(row => {
      if (row.variant) onDraftSet.add(row.variant.toLowerCase());
    });

    // Enrich cans with beer details and draft status
    const enrichedCansPromises = cansData
      .filter(row => row.variant)
      .map(async (row) => {
        const beerDetails = beerMap.get(row.variant.toLowerCase());
        const hasImage = await imageExists(row.variant);
        return {
          variant: row.variant,
          name: row.name || beerDetails?.name || '',
          type: row.type || beerDetails?.type || '',
          abv: row.abv || beerDetails?.abv || '',
          image: hasImage,
          onDraft: onDraftSet.has(row.variant.toLowerCase()),
          glass: beerDetails?.glass
        };
      });

    const enrichedCans = await Promise.all(enrichedCansPromises);
    return enrichedCans;
  } catch (error) {
    logger.error(`Error loading cans for ${location}`, error);
    return [];
  }
});

/**
 * Get upcoming events for a specific location
 * Cached for deduplication across requests
 */
export const getUpcomingEvents = cache(async (location: 'lawrenceville' | 'zelienople') => {
  try {
    const eventsText = await readCSV(`${location}-events.csv`);
    const eventsData = parseCSV<EventRow>(eventsText);

    // Get today's date at midnight local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter for today and future events
    const upcomingEvents = eventsData
      .filter(row => {
        if (!row.date || !row.vendor) return false;

        const [year, month, day] = row.date.split('-').map(Number);
        if (!year || !month || !day) return false;

        const eventDate = new Date(year, month - 1, day);
        return eventDate >= today;
      })
      .map(row => ({
        date: row.date,
        vendor: row.vendor,
        time: row.time || '',
        attendees: row.attendees || '',
        site: row.site || '',
        end: row.end || '',
        location: location === 'lawrenceville' ? Location.LAWRENCEVILLE : Location.ZELIENOPLE
      }));

    // Sort by date
    upcomingEvents.sort((a, b) => compareDateStrings(a.date, b.date));

    return upcomingEvents.slice(0, 3);
  } catch (error) {
    logger.error(`Error loading events for ${location}`, error);
    return [];
  }
});

/**
 * Get upcoming food vendors for a specific location
 * Cached for deduplication across requests
 */
export const getUpcomingFood = cache(async (location: 'lawrenceville' | 'zelienople') => {
  try {
    const foodText = await readCSV(`${location}-food.csv`);
    const foodData = parseCSV<FoodRow>(foodText);

    // Get today's date at midnight local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter for today and future food vendors
    const upcomingFood = foodData
      .filter(row => {
        if (!row.vendor || !row.date) return false;

        const [year, month, day] = row.date.split('-').map(Number);
        if (!year || !month || !day) return false;

        const vendorDate = new Date(year, month - 1, day);
        return vendorDate >= today;
      })
      .map(row => ({
        vendor: row.vendor,
        date: row.date,
        time: row.time || '',
        site: row.site || '',
        day: row.day || '',
        location: location === 'lawrenceville' ? Location.LAWRENCEVILLE : Location.ZELIENOPLE
      }));

    // Sort by date
    upcomingFood.sort((a, b) => compareDateStrings(a.date, b.date));

    return upcomingFood.slice(0, 3);
  } catch (error) {
    logger.error(`Error loading food for ${location}`, error);
    return [];
  }
});
