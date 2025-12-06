/**
 * Utility to merge beer data with location-specific availability from CSV files
 */

import Papa from 'papaparse';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Beer } from '@/lib/types/beer';

interface CanData {
  variant: string;
  cansAvailable: boolean;
  cansSingle?: number;
  fourPack?: number;
  salePrice?: boolean;
}

/**
 * Fetch and parse can data for a location
 */
async function fetchCanData(locationSlug: string): Promise<Map<string, CanData>> {
  try {
    const filePath = join(process.cwd(), 'public', 'data', `${locationSlug}-cans.csv`);
    const text = await readFile(filePath, 'utf-8');
    const parsed = Papa.parse(text, { header: true });
    const canDataMap = new Map<string, CanData>();

    parsed.data.forEach((row: any) => {
      const variant = row.variant?.toLowerCase();
      if (variant) {
        const parsePrice = (value: string | undefined): number | undefined => {
          if (!value || value === '') return undefined;
          const num = parseFloat(value);
          return isNaN(num) ? undefined : num;
        };

        canDataMap.set(variant, {
          variant,
          cansAvailable: row.cansAvailable === 'TRUE',
          cansSingle: parsePrice(row.cansSingle),
          fourPack: parsePrice(row.fourPack),
          salePrice: row.salePrice === 'TRUE',
        });
      }
    });

    return canDataMap;
  } catch (error) {
    console.error(`Error fetching can data for ${locationSlug}:`, error);
    return new Map();
  }
}

/**
 * Merge beer data with can availability from all locations
 * @param beer - The beer to merge data for
 * @param locationSlugs - List of location slugs to check for can data
 */
export async function mergeBeerDataWithCans(beer: Beer, locationSlugs: string[] = []): Promise<Beer> {
  // Fetch can data for all locations
  const canDataByLocation = await Promise.all(
    locationSlugs.map(async slug => ({
      slug,
      data: await fetchCanData(slug)
    }))
  );

  // Check all locations for can availability
  let cansAvailable = false;
  let canData: CanData | undefined;

  for (const { data } of canDataByLocation) {
    const locationCanData = data.get(beer.variant.toLowerCase());
    if (locationCanData?.cansAvailable) {
      cansAvailable = true;
      // Use first available pricing data found
      if (!canData) {
        canData = locationCanData;
      }
    }
  }

  return {
    ...beer,
    availability: {
      ...beer.availability,
      cansAvailable,
    },
    pricing: {
      ...beer.pricing,
      cansSingle: canData?.cansSingle || beer.pricing.cansSingle,
      fourPack: canData?.fourPack || beer.pricing.fourPack,
      salePrice: canData?.salePrice ?? beer.pricing.salePrice,
    },
  };
}
