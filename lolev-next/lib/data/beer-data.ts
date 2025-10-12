/**
 * Server-side data fetching utilities for beer data
 * Fetches and parses CSV files with caching
 */

import Papa from 'papaparse';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '@/lib/utils/logger';

interface BeerRow {
  variant: string;
  name: string;
  type?: string;
  abv?: string;
  image?: string;
  hideFromSite?: string;
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

// Parse CSV with PapaParse
function parseCSV<T>(csvText: string): T[] {
  const result = Papa.parse<T>(csvText, {
    header: true,
    skipEmptyLines: true
  });
  return result.data;
}

/**
 * Get all available beers (beers that are currently on tap or in cans)
 */
export async function getAvailableBeers(): Promise<{ variant: string; name: string }[]> {
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
    const beersWithImages = beerData
      .filter(row =>
        row.variant &&
        availableVariants.has(row.variant.toLowerCase()) &&
        row.image === 'TRUE' &&
        row.hideFromSite !== 'TRUE'
      )
      .map(row => ({
        variant: row.variant,
        name: row.name
      }));

    return beersWithImages;
  } catch (error) {
    logger.error('Error loading available beers', error);
    return [];
  }
}

/**
 * Get draft beers for a specific location
 */
export async function getDraftBeers(location: 'lawrenceville' | 'zelienople') {
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

    // Parse draft beers
    const draftData = parseCSV<DraftBeerRow>(draftText);
    const beers = draftData
      .filter(row => row.variant)
      .map(row => ({
        tap: row.tap || '',
        variant: row.variant,
        name: row.name || '',
        type: row.type || '',
        abv: row.abv || '',
        glass: row.glass || '',
        price: row.price || '',
        description: row.description || '',
        image: row.image === 'TRUE',
        cansAvailable: cansSet.has(row.variant.toLowerCase())
      }));

    return beers;
  } catch (error) {
    logger.error(`Error loading draft beers for ${location}`, error);
    return [];
  }
}

/**
 * Get enriched can data for a specific location
 */
export async function getEnrichedCans(location: 'lawrenceville' | 'zelienople') {
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
    const enrichedCans = cansData
      .filter(row => row.variant)
      .map(row => {
        const beerDetails = beerMap.get(row.variant.toLowerCase());
        return {
          variant: row.variant,
          name: row.name || beerDetails?.name || '',
          type: row.type || beerDetails?.type || '',
          abv: row.abv || beerDetails?.abv || '',
          image: beerDetails?.image === 'TRUE',
          onDraft: onDraftSet.has(row.variant.toLowerCase())
        };
      });

    return enrichedCans;
  } catch (error) {
    logger.error(`Error loading cans for ${location}`, error);
    return [];
  }
}

/**
 * Get upcoming events for a specific location
 */
export async function getUpcomingEvents(location: 'lawrenceville' | 'zelienople') {
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
        end: row.end || ''
      }));

    // Sort by date
    upcomingEvents.sort((a, b) => {
      const [yearA, monthA, dayA] = a.date.split('-').map(Number);
      const [yearB, monthB, dayB] = b.date.split('-').map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateA.getTime() - dateB.getTime();
    });

    return upcomingEvents.slice(0, 3);
  } catch (error) {
    logger.error(`Error loading events for ${location}`, error);
    return [];
  }
}

/**
 * Get upcoming food vendors for a specific location
 */
export async function getUpcomingFood(location: 'lawrenceville' | 'zelienople') {
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
        day: row.day || ''
      }));

    // Sort by date
    upcomingFood.sort((a, b) => {
      const [yearA, monthA, dayA] = a.date.split('-').map(Number);
      const [yearB, monthB, dayB] = b.date.split('-').map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateA.getTime() - dateB.getTime();
    });

    return upcomingFood.slice(0, 3);
  } catch (error) {
    logger.error(`Error loading food for ${location}`, error);
    return [];
  }
}
