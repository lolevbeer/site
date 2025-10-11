import { Beer, GlassType } from '@/lib/types/beer';
import { readFile } from 'fs/promises';
import { join } from 'path';
import Papa from 'papaparse';

export async function getAllBeersFromCSV(): Promise<Beer[]> {
  const filePath = join(process.cwd(), 'public', 'data', 'beer.csv');
  const fileContent = await readFile(filePath, 'utf-8');

  // Load draft and cans data
  const lawrencevilleDraftPath = join(process.cwd(), 'public', 'data', 'lawrenceville-draft.csv');
  const zelienopleDraftPath = join(process.cwd(), 'public', 'data', 'zelienople-draft.csv');
  const lawrencevilleCansPath = join(process.cwd(), 'public', 'data', 'lawrenceville-cans.csv');
  const zelienopleCansPath = join(process.cwd(), 'public', 'data', 'zelienople-cans.csv');

  const [lawrencevilleDraft, zelienopleDraft, lawrencevilleCans, zelienopleCans] = await Promise.all([
    readFile(lawrencevilleDraftPath, 'utf-8').catch(() => ''),
    readFile(zelienopleDraftPath, 'utf-8').catch(() => ''),
    readFile(lawrencevilleCansPath, 'utf-8').catch(() => ''),
    readFile(zelienopleCansPath, 'utf-8').catch(() => ''),
  ]);

  // Create sets of variants pouring and in cans
  const onTapVariants = new Set<string>();
  const inCansVariants = new Set<string>();

  const parseDraft = (content: string) => {
    if (!content) return;
    const parsed = Papa.parse(content, { header: true });
    parsed.data.forEach((row: any) => {
      if (row.variant) onTapVariants.add(row.variant.toLowerCase());
    });
  };

  const parseCans = (content: string) => {
    if (!content) return;
    const parsed = Papa.parse(content, { header: true });
    parsed.data.forEach((row: any) => {
      if (row.variant) inCansVariants.add(row.variant.toLowerCase());
    });
  };

  parseDraft(lawrencevilleDraft);
  parseDraft(zelienopleDraft);
  parseCans(lawrencevilleCans);
  parseCans(zelienopleCans);

  // Parse main beer CSV
  const parsed = Papa.parse(fileContent, { header: true });
  const beers: Beer[] = [];

  parsed.data.forEach((row: any) => {
    const variant = row.variant?.trim();
    const name = row.name?.trim();

    // Skip empty rows
    if (!variant || !name) return;

    const variantLower = variant.toLowerCase();
    const beer: Beer = {
      variant,
      name,
      type: row.type?.trim() || '',
      abv: parseFloat(row.abv) || 0,
      glass: row.glass?.trim() as GlassType,
      description: row.description?.trim() || '',
      glutenFree: row.glutenFree === 'TRUE',
      image: row.image === 'TRUE',
      pricing: {
        draftPrice: row.draftPrice?.replace('$', '').trim() || undefined,
        canSingle: row.canSingle?.replace('$', '').trim() || undefined,
        cansSingle: row.canSingle?.replace('$', '').trim() || undefined,
        fourPack: row.fourPack?.replace('$', '').trim() || undefined,
        salePrice: false,
      },
      availability: {
        tap: onTapVariants.has(variantLower) ? 'Available' : '',
        cansAvailable: inCansVariants.has(variantLower),
        singleCanAvailable: false,
        hideFromSite: row.hideFromSite === 'TRUE',
      },
      hops: row.hops?.trim() || undefined,
      recipe: row.recipe ? parseInt(row.recipe) : undefined,
      upc: row.upc?.trim() || undefined,
      untappd: row.untappd ? parseInt(row.untappd) : undefined,
      options: row.options?.trim() || undefined,
    };

    beers.push(beer);
  });

  return beers;
}

export async function getBeerByVariant(variant: string): Promise<Beer | null> {
  const beers = await getAllBeersFromCSV();
  return beers.find(b => b.variant.toLowerCase() === variant.toLowerCase()) || null;
}
