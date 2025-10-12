/**
 * CSV to TypeScript transformers
 * Functions to convert CSV data from the parent directory's _data folder into typed objects
 */

import {
  Beer,
  BeerStyle,
  GlassType,
  BreweryEvent,
  EventType,
  EventStatus,
  FoodVendorSchedule,
  DayOfWeek,
  Location,
} from '../types';

/**
 * CSV row interface for beer data
 */
interface BeerCSVRow {
  variant: string;
  name: string;
  type: string;
  options?: string;
  abv: string;
  glass: string;
  draftPrice?: string;
  canSingle?: string;
  fourPack?: string;
  description: string;
  upc?: string;
  glutenFree: string;
  image: string;
  hideFromSite?: string;
  untappd?: string;
  recipe?: string;
  hops?: string;
  cansAvailable?: string;
  singleCanAvailable?: string;
  tap?: string;
}

/**
 * CSV row interface for event data
 */
interface EventCSVRow {
  date: string;
  vendor: string;
  time: string;
  attendees?: string;
  site?: string;
  end?: string;
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  price?: string;
  featured?: string;
}

/**
 * CSV row interface for food vendor schedule data
 */
interface FoodCSVRow {
  vendor: string;
  date: string;
  time: string;
  site?: string;
  day: string;
  start: string;
  finish: string;
  week?: string;
  dayNumber: string;
  notes?: string;
}

/**
 * Transform beer CSV row to Beer object
 */
export function transformBeerCSV(row: BeerCSVRow): Beer {
  // Parse boolean values
  const parseBoolean = (value: string | undefined): boolean => {
    return value?.toLowerCase() === 'true' || value === '1';
  };

  // Parse number values
  const parseNumber = (value: string | undefined): number | undefined => {
    if (!value || value === '') return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  };

  // Map glass type from string
  const getGlassType = (glass: string): GlassType => {
    switch (glass.toLowerCase()) {
      case 'pint':
        return GlassType.PINT;
      case 'teku':
        return GlassType.TEKU;
      case 'stein':
        return GlassType.STEIN;
      default:
        return GlassType.PINT;
    }
  };

  // Map beer style from string
  const getBeerStyle = (type: string): BeerStyle | string => {
    // Check if it matches a known enum value
    const normalizedType = type.replace(/[éö]/g, (match) => {
      if (match === 'é') return 'e';
      if (match === 'ö') return 'o';
      return match;
    });

    const styleValues = Object.values(BeerStyle);
    const matchedStyle = styleValues.find(style =>
      style.toLowerCase() === normalizedType.toLowerCase()
    );

    return matchedStyle || type; // Return original if no match
  };

  return {
    variant: row.variant,
    name: row.name,
    type: getBeerStyle(row.type),
    options: row.options,
    abv: parseFloat(row.abv),
    glass: getGlassType(row.glass),
    description: row.description,
    upc: row.upc,
    glutenFree: parseBoolean(row.glutenFree),
    image: parseBoolean(row.image),
    untappd: parseNumber(row.untappd),
    recipe: parseNumber(row.recipe),
    hops: row.hops,
    pricing: {
      draftPrice: parseNumber(row.draftPrice),
      canSingle: parseNumber(row.canSingle),
      fourPack: parseNumber(row.fourPack),
    },
    availability: {
      cansAvailable: parseBoolean(row.cansAvailable),
      singleCanAvailable: parseBoolean(row.singleCanAvailable),
      hideFromSite: parseBoolean(row.hideFromSite),
      tap: row.tap,
    },
  };
}

/**
 * Transform event CSV row to BreweryEvent object
 */
export function transformEventCSV(row: EventCSVRow, location: Location): BreweryEvent {
  // Parse number values
  const parseNumber = (value: string | undefined): number | undefined => {
    if (!value || value === '') return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  };

  // Determine event type from vendor or title
  const getEventType = (vendor: string, title?: string): EventType => {
    const text = `${vendor} ${title || ''}`.toLowerCase();

    if (text.includes('trivia')) return EventType.TRIVIA;
    if (text.includes('music') || text.includes('band') || text.includes('performance')) {
      return EventType.LIVE_MUSIC;
    }
    if (text.includes('game') || text.includes('games')) return EventType.GAME_NIGHT;
    if (text.includes('market') || text.includes('vendor')) return EventType.MARKET;
    if (text.includes('tour')) return EventType.BREWERY_TOUR;
    if (text.includes('tasting')) return EventType.TASTING;
    if (text.includes('food') && text.includes('pairing')) return EventType.FOOD_PAIRING;

    return EventType.SPECIAL_EVENT;
  };

  // Generate ID from date and vendor
  const generateId = (date: string, vendor: string): string => {
    return `${date}-${vendor.toLowerCase().replace(/\s+/g, '-')}`;
  };

  return {
    id: generateId(row.date, row.vendor),
    title: row.title || row.vendor,
    description: row.description,
    date: row.date,
    time: row.time,
    vendor: row.vendor,
    attendees: parseNumber(row.attendees),
    site: row.site,
    end: row.end,
    type: row.type ? (row.type as EventType) : getEventType(row.vendor, row.title),
    status: row.status ? (row.status as EventStatus) : EventStatus.SCHEDULED,
    location,
    price: row.price,
  };
}

/**
 * Transform food vendor CSV row to FoodVendorSchedule object
 */
export function transformFoodCSV(row: FoodCSVRow, location: Location): FoodVendorSchedule {

  // Map day string to DayOfWeek enum
  const getDayOfWeek = (day: string): DayOfWeek => {
    const dayMap: Record<string, DayOfWeek> = {
      'sunday': DayOfWeek.SUNDAY,
      'monday': DayOfWeek.MONDAY,
      'tuesday': DayOfWeek.TUESDAY,
      'wednesday': DayOfWeek.WEDNESDAY,
      'thursday': DayOfWeek.THURSDAY,
      'friday': DayOfWeek.FRIDAY,
      'saturday': DayOfWeek.SATURDAY,
    };

    return dayMap[day.toLowerCase()] || DayOfWeek.MONDAY;
  };

  return {
    vendor: row.vendor,
    date: row.date,
    time: row.time,
    site: row.site,
    day: getDayOfWeek(row.day),
    start: row.start,
    finish: row.finish,
    week: row.week,
    dayNumber: parseInt(row.dayNumber, 10),
    location,
    notes: row.notes,
  };
}

/**
 * Parse CSV text into objects
 */
export function parseCSV<T>(csvText: string): T[] {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(header => header.replace(/"/g, '').trim());
  const rows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      // Build object dynamically from headers and values
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      // Type assertion is safe here as T should be a Record<string, string> compatible type
      rows.push(row as T);
    }
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"' && (i === 0 || line[i - 1] === ',')) {
      // Start of quoted value
      inQuotes = true;
    } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i + 1] === ',')) {
      // End of quoted value
      inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      // Field separator
      values.push(current.trim());
      current = '';
    } else {
      // Regular character
      current += char;
    }

    i++;
  }

  // Add the last value
  values.push(current.trim());

  return values;
}

/**
 * Transform beer CSV data to Beer objects
 */
export function transformBeersFromCSV(csvText: string): Beer[] {
  const rows = parseCSV<BeerCSVRow>(csvText);
  return rows.map(transformBeerCSV);
}

/**
 * Transform events CSV data to BreweryEvent objects
 */
export function transformEventsFromCSV(csvText: string, location: Location): BreweryEvent[] {
  const rows = parseCSV<EventCSVRow>(csvText);
  return rows.map(row => transformEventCSV(row, location));
}

/**
 * Transform food CSV data to FoodVendorSchedule objects
 */
export function transformFoodFromCSV(csvText: string, location: Location): FoodVendorSchedule[] {
  const rows = parseCSV<FoodCSVRow>(csvText);
  return rows.map(row => transformFoodCSV(row, location));
}

/**
 * Utility function to read and transform CSV files (for server-side use)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function loadCSVData(_filePath: string): Promise<string> {
  // This would be used on the server side to read CSV files
  // In a real implementation, you'd use fs.readFile or similar
  throw new Error('loadCSVData should be implemented on the server side');
}

/**
 * Batch transform multiple CSV files
 */
export interface CSVTransformResult {
  beers: Beer[];
  lawrencevilleEvents: BreweryEvent[];
  zelienopleEvents: BreweryEvent[];
  lawrencevilleFood: FoodVendorSchedule[];
  zelienopleFood: FoodVendorSchedule[];
}

/**
 * Transform all CSV data at once (for server-side bulk processing)
 */
export function transformAllCSVData(csvData: {
  beer: string;
  lawrencevilleEvents: string;
  zelienopleEvents: string;
  lawrencevilleFood: string;
  zelienopleFood: string;
}): CSVTransformResult {
  return {
    beers: transformBeersFromCSV(csvData.beer),
    lawrencevilleEvents: transformEventsFromCSV(csvData.lawrencevilleEvents, Location.LAWRENCEVILLE),
    zelienopleEvents: transformEventsFromCSV(csvData.zelienopleEvents, Location.ZELIENOPLE),
    lawrencevilleFood: transformFoodFromCSV(csvData.lawrencevilleFood, Location.LAWRENCEVILLE),
    zelienopleFood: transformFoodFromCSV(csvData.zelienopleFood, Location.ZELIENOPLE),
  };
}

/**
 * Validation functions
 */
export const validators = {
  /**
   * Validate beer object
   */
  validateBeer(beer: Partial<Beer>): string[] {
    const errors: string[] = [];

    if (!beer.variant) errors.push('variant is required');
    if (!beer.name) errors.push('name is required');
    if (!beer.type) errors.push('type is required');
    if (typeof beer.abv !== 'number' || beer.abv < 0) errors.push('abv must be a positive number');
    if (!beer.glass) errors.push('glass type is required');
    if (!beer.description) errors.push('description is required');

    return errors;
  },

  /**
   * Validate event object
   */
  validateEvent(event: Partial<BreweryEvent>): string[] {
    const errors: string[] = [];

    if (!event.title) errors.push('title is required');
    if (!event.date) errors.push('date is required');
    if (!event.time) errors.push('time is required');
    if (!event.vendor) errors.push('vendor is required');
    if (!event.type) errors.push('type is required');
    if (!event.status) errors.push('status is required');
    if (!event.location) errors.push('location is required');

    return errors;
  },

  /**
   * Validate food vendor schedule object
   */
  validateFoodSchedule(schedule: Partial<FoodVendorSchedule>): string[] {
    const errors: string[] = [];

    if (!schedule.vendor) errors.push('vendor is required');
    if (!schedule.date) errors.push('date is required');
    if (!schedule.time) errors.push('time is required');
    if (!schedule.day) errors.push('day is required');
    if (!schedule.start) errors.push('start time is required');
    if (!schedule.finish) errors.push('finish time is required');
    if (!schedule.location) errors.push('location is required');
    if (typeof schedule.dayNumber !== 'number') errors.push('dayNumber must be a number');

    return errors;
  },
};

const transformers = {
  transformBeerCSV,
  transformEventCSV,
  transformFoodCSV,
  parseCSV,
  transformBeersFromCSV,
  transformEventsFromCSV,
  transformFoodFromCSV,
  transformAllCSVData,
  validators,
};

export default transformers;