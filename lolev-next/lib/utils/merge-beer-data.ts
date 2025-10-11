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
  cansSingle?: string;
  fourPack?: string;
  salePrice?: boolean;
}

/**
 * Fetch and parse can data for a location
 */
async function fetchCanData(location: 'lawrenceville' | 'zelienople'): Promise<Map<string, CanData>> {
  try {
    const filePath = join(process.cwd(), 'public', 'data', `${location}-cans.csv`);
    const text = await readFile(filePath, 'utf-8');
    const parsed = Papa.parse(text, { header: true });
    const canDataMap = new Map<string, CanData>();

    parsed.data.forEach((row: any) => {
      const variant = row.variant?.toLowerCase();
      if (variant) {
        canDataMap.set(variant, {
          variant,
          cansAvailable: row.cansAvailable === 'TRUE',
          cansSingle: row.cansSingle,
          fourPack: row.fourPack,
          salePrice: row.salePrice === 'TRUE',
        });
      }
    });

    return canDataMap;
  } catch (error) {
    console.error(`Error fetching can data for ${location}:`, error);
    return new Map();
  }
}

/**
 * Merge beer data with can availability from both locations
 */
export async function mergeBeerDataWithCans(beer: Beer): Promise<Beer> {
  const [lawrencevilleData, zelienopleData] = await Promise.all([
    fetchCanData('lawrenceville'),
    fetchCanData('zelienople'),
  ]);

  // Check both locations for can availability
  const lawrencevilleCan = lawrencevilleData.get(beer.variant.toLowerCase());
  const zelienopleCan = zelienopleData.get(beer.variant.toLowerCase());

  // Merge the data
  const cansAvailable = !!(lawrencevilleCan?.cansAvailable || zelienopleCan?.cansAvailable);

  // Prefer lawrenceville pricing if available, otherwise use zelienople
  const canData = lawrencevilleCan?.cansAvailable ? lawrencevilleCan : zelienopleCan;

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
