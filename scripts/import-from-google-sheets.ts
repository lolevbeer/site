/**
 * Import Events and Food data from Google Sheets (published as CSV) into Payload CMS
 *
 * Setup:
 * 1. In Google Sheets: File → Share → Publish to web → Select sheet → CSV format
 * 2. Copy the published CSV URL
 * 3. Set the URLs in .env or update SHEETS_CONFIG below
 *
 * Usage:
 *   pnpm tsx scripts/import-from-google-sheets.ts
 *
 * Options:
 *   --dry-run    Preview what would be imported without writing to database
 *   --events     Import only events
 *   --food       Import only food
 */

import 'dotenv/config';
import { getPayload } from 'payload';
import config from '../src/payload.config';

// Published CSV URLs from Google Sheets
// Format: https://docs.google.com/spreadsheets/d/{SHEET_ID}/pub?gid={GID}&single=true&output=csv
const SHEETS_CONFIG = {
  events: {
    lawrenceville: process.env.GOOGLE_CSV_EVENTS_LAWRENCEVILLE || '',
    zelienople: process.env.GOOGLE_CSV_EVENTS_ZELIENOPLE || '',
  },
  food: {
    lawrenceville: process.env.GOOGLE_CSV_FOOD_LAWRENCEVILLE || '',
    zelienople: process.env.GOOGLE_CSV_FOOD_ZELIENOPLE || '',
  },
};

interface EventRow {
  date: string;
  vendor: string;
  time: string;
  attendees?: string;
  site?: string;
  end?: string;
}

interface FoodRow {
  vendor: string;
  date: string;
  time: string;
  site?: string;
  day?: string;
  start?: string;
  finish?: string;
  week?: string;
  dayNumber?: string;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header.toLowerCase().trim()] = values[i]?.trim() || '';
    });
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

async function fetchCSV(url: string): Promise<Record<string, string>[]> {
  if (!url) return [];

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    return parseCSV(text);
  } catch (error: any) {
    console.error(`  Error fetching CSV: ${error.message}`);
    return [];
  }
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Handle YYYY-MM-DD format
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(`${dateStr}T12:00:00`);
  }

  // Try parsing as-is
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

async function importEvents(
  payload: any,
  locationSlug: 'lawrenceville' | 'zelienople',
  dryRun: boolean
) {
  const url = SHEETS_CONFIG.events[locationSlug];
  console.log(`\nImporting events for ${locationSlug}...`);

  if (!url) {
    console.log(`  Skipping - no URL configured`);
    return { imported: 0, skipped: 0, errors: 0 };
  }

  const rows = await fetchCSV(url);
  const events = rows.filter(r => r.date && r.vendor) as unknown as EventRow[];

  console.log(`  Found ${events.length} events`);

  if (events.length === 0 || dryRun) {
    if (dryRun && events.length > 0) {
      console.log(`  [DRY RUN] Would import:`);
      events.slice(0, 5).forEach(e => console.log(`    - ${e.date}: ${e.vendor}`));
      if (events.length > 5) console.log(`    ... and ${events.length - 5} more`);
    }
    return { imported: 0, skipped: 0, errors: 0 };
  }

  // Get location ID
  const location = await payload.find({
    collection: 'locations',
    where: { slug: { equals: locationSlug } },
    limit: 1,
  });

  if (!location.docs[0]) {
    console.error(`  Location "${locationSlug}" not found in database`);
    return { imported: 0, skipped: 0, errors: events.length };
  }

  const locationId = location.docs[0].id;
  let imported = 0, skipped = 0, errors = 0;

  for (const event of events) {
    const date = parseDate(event.date);
    if (!date) {
      console.log(`  Skipping "${event.vendor}" - invalid date: ${event.date}`);
      skipped++;
      continue;
    }

    try {
      // Check for existing event
      const existing = await payload.find({
        collection: 'events',
        where: {
          and: [
            { vendor: { equals: event.vendor } },
            { date: { equals: date.toISOString() } },
            { location: { equals: locationId } },
          ],
        },
        limit: 1,
      });

      if (existing.docs.length > 0) {
        skipped++;
        continue;
      }

      await payload.create({
        collection: 'events',
        data: {
          vendor: event.vendor,
          date: date.toISOString(),
          time: event.time || undefined,
          endTime: event.end || undefined,
          location: locationId,
          visibility: 'public',
          site: event.site || undefined,
          attendees: event.attendees ? parseInt(event.attendees) : undefined,
        },
      });
      imported++;
    } catch (error: any) {
      console.error(`  Error importing "${event.vendor}": ${error.message}`);
      errors++;
    }
  }

  console.log(`  Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors}`);
  return { imported, skipped, errors };
}

async function importFood(
  payload: any,
  locationSlug: 'lawrenceville' | 'zelienople',
  dryRun: boolean
) {
  const url = SHEETS_CONFIG.food[locationSlug];
  console.log(`\nImporting food for ${locationSlug}...`);

  if (!url) {
    console.log(`  Skipping - no URL configured`);
    return { imported: 0, skipped: 0, errors: 0 };
  }

  const rows = await fetchCSV(url);
  const foods = rows.filter(r => r.vendor && r.date) as unknown as FoodRow[];

  console.log(`  Found ${foods.length} food entries`);

  if (foods.length === 0 || dryRun) {
    if (dryRun && foods.length > 0) {
      console.log(`  [DRY RUN] Would import:`);
      foods.slice(0, 5).forEach(f => console.log(`    - ${f.date}: ${f.vendor}`));
      if (foods.length > 5) console.log(`    ... and ${foods.length - 5} more`);
    }
    return { imported: 0, skipped: 0, errors: 0 };
  }

  // Get location ID
  const location = await payload.find({
    collection: 'locations',
    where: { slug: { equals: locationSlug } },
    limit: 1,
  });

  if (!location.docs[0]) {
    console.error(`  Location "${locationSlug}" not found in database`);
    return { imported: 0, skipped: 0, errors: foods.length };
  }

  const locationId = location.docs[0].id;
  let imported = 0, skipped = 0, errors = 0;

  for (const food of foods) {
    const date = parseDate(food.date);
    if (!date) {
      console.log(`  Skipping "${food.vendor}" - invalid date: ${food.date}`);
      skipped++;
      continue;
    }

    try {
      // Check for existing food entry
      const existing = await payload.find({
        collection: 'food',
        where: {
          and: [
            { vendor: { equals: food.vendor } },
            { date: { equals: date.toISOString() } },
            { location: { equals: locationId } },
          ],
        },
        limit: 1,
      });

      if (existing.docs.length > 0) {
        skipped++;
        continue;
      }

      await payload.create({
        collection: 'food',
        data: {
          vendor: food.vendor,
          date: date.toISOString(),
          time: food.time || 'TBD',
          location: locationId,
          site: food.site || undefined,
          day: food.day || undefined,
          start: food.start || undefined,
          finish: food.finish || undefined,
          week: food.week ? parseInt(food.week) : undefined,
          dayNumber: food.dayNumber ? parseInt(food.dayNumber) : undefined,
        },
      });
      imported++;
    } catch (error: any) {
      console.error(`  Error importing "${food.vendor}": ${error.message}`);
      errors++;
    }
  }

  console.log(`  Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors}`);
  return { imported, skipped, errors };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const eventsOnly = args.includes('--events');
  const foodOnly = args.includes('--food');

  console.log('='.repeat(50));
  console.log('Google Sheets CSV → Payload CMS Import');
  console.log('='.repeat(50));

  if (dryRun) {
    console.log('\n[DRY RUN MODE - No data will be written]\n');
  }

  try {
    const payload = await getPayload({ config });
    console.log('Connected to Payload CMS');

    const results = {
      events: { imported: 0, skipped: 0, errors: 0 },
      food: { imported: 0, skipped: 0, errors: 0 },
    };

    if (!foodOnly) {
      const eventsLville = await importEvents(payload, 'lawrenceville', dryRun);
      const eventsZelie = await importEvents(payload, 'zelienople', dryRun);
      results.events = {
        imported: eventsLville.imported + eventsZelie.imported,
        skipped: eventsLville.skipped + eventsZelie.skipped,
        errors: eventsLville.errors + eventsZelie.errors,
      };
    }

    if (!eventsOnly) {
      const foodLville = await importFood(payload, 'lawrenceville', dryRun);
      const foodZelie = await importFood(payload, 'zelienople', dryRun);
      results.food = {
        imported: foodLville.imported + foodZelie.imported,
        skipped: foodLville.skipped + foodZelie.skipped,
        errors: foodLville.errors + foodZelie.errors,
      };
    }

    console.log('\n' + '='.repeat(50));
    console.log('Import Summary');
    console.log('='.repeat(50));
    console.log(`Events: ${results.events.imported} imported, ${results.events.skipped} skipped, ${results.events.errors} errors`);
    console.log(`Food:   ${results.food.imported} imported, ${results.food.skipped} skipped, ${results.food.errors} errors`);

  } catch (error: any) {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
