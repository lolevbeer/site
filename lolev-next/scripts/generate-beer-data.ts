#!/usr/bin/env tsx
/**
 * Generate beer-data.ts from CSV
 * Run with: npx tsx scripts/generate-beer-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const CSV_PATH = path.join(process.cwd(), '..', '_data', 'beer.csv');
const OUTPUT_PATH = path.join(process.cwd(), 'lib', 'data', 'beer-data.ts');

interface CSVBeer {
  variant: string;
  name: string;
  type: string;
  options: string;
  abv: string;
  glass: string;
  draftPrice: string;
  canSingle: string;
  fourPack: string;
  description: string;
  upc: string;
  glutenFree: string;
  image: string;
  hideFromSite: string;
  untappd: string;
  recipe: string;
  hops: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(csvText: string): CSVBeer[] {
  const lines = csvText.split('\n');
  const headers = parseCSVLine(lines[0]);
  const beers: CSVBeer[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const beer: any = {};

    headers.forEach((header, index) => {
      beer[header] = values[index] || '';
    });

    if (beer.variant) {
      beers.push(beer as CSVBeer);
    }
  }

  return beers;
}

function generateTypeScriptCode(beers: CSVBeer[]): string {
  let code = `/**
 * Beer data imported from CSV
 * Auto-generated from _data/beer.csv
 */

import { Beer } from '@/lib/types/beer';

export const beers: Beer[] = [
`;

  beers.forEach((beer) => {
    code += `  {
    variant: '${beer.variant}',
    name: '${beer.name}',
    type: '${beer.type}',`;

    if (beer.options) {
      code += `
    options: '${beer.options}',`;
    }

    code += `
    abv: ${beer.abv || 0},
    glass: '${beer.glass}',`;

    if (beer.description) {
      const escapedDesc = beer.description.replace(/'/g, "\\'").replace(/\n/g, ' ');
      code += `
    description: '${escapedDesc}',`;
    }

    code += `
    glutenFree: ${beer.glutenFree === 'TRUE'},
    image: ${beer.image === 'TRUE'},`;

    // Pricing
    code += `
    pricing: {`;
    if (beer.draftPrice && beer.draftPrice.startsWith('$')) {
      code += `
      draftPrice: '${beer.draftPrice.substring(1)}',`;
    }
    if (beer.canSingle && beer.canSingle.startsWith('$')) {
      code += `
      canSingle: '${beer.canSingle.substring(1)}',`;
    }
    if (beer.fourPack && beer.fourPack.startsWith('$')) {
      code += `
      fourPack: '${beer.fourPack.substring(1)}',`;
    }
    code += `
    },`;

    // Availability
    code += `
    availability: {
      tap: '',
      cansAvailable: false,
      singleCanAvailable: false,`;
    if (beer.hideFromSite === 'TRUE') {
      code += `
      hideFromSite: true,`;
    }
    code += `
    },`;

    if (beer.hops) {
      code += `
    hops: '${beer.hops}',`;
    }

    if (beer.recipe) {
      code += `
    recipe: ${beer.recipe},`;
    }

    if (beer.upc) {
      code += `
    upc: '${beer.upc}',`;
    }

    if (beer.untappd) {
      code += `
    untappd: ${beer.untappd},`;
    }

    code += `
  },
`;
  });

  code += `];
`;

  return code;
}

// Main execution
try {
  console.log('Reading CSV from:', CSV_PATH);
  const csvText = fs.readFileSync(CSV_PATH, 'utf-8');

  console.log('Parsing CSV...');
  const beers = parseCSV(csvText);
  console.log(`Found ${beers.length} beers`);

  console.log('Generating TypeScript code...');
  const tsCode = generateTypeScriptCode(beers);

  console.log('Writing to:', OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, tsCode, 'utf-8');

  console.log('✅ Successfully generated beer-data.ts');
} catch (error) {
  console.error('❌ Error generating beer-data.ts:', error);
  process.exit(1);
}
