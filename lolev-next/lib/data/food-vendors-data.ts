/**
 * Food vendors data imported from CSV files
 * Auto-generated from _data/lawrenceville-food.csv and zelienople-food.csv
 */

import { Location } from '@/lib/types';

export interface FoodVendor {
  id: string;
  name: string;
  date: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  website?: string;
  location: Location;
  cuisine?: string;
  featured?: boolean;
}

// Helper function to parse time strings
function parseVendorTime(timeStr: string): { startTime?: string; endTime?: string } {
  if (!timeStr) return {};

  // Handle formats like "4-9pm" or "5-9"
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?\s*(pm|am)?/i);
  if (match) {
    let start = match[1];
    let end = match[3];
    const period = match[5];

    if (match[2]) start += `:${match[2]}`;
    else start += ':00';

    if (match[4]) end += `:${match[4]}`;
    else end += ':00';

    if (period) {
      start += ` ${period.toUpperCase()}`;
      end += ` ${period.toUpperCase()}`;
    }

    return { startTime: start, endTime: end };
  }

  return { startTime: timeStr };
}

// Helper function to determine cuisine type from vendor name
function getCuisineType(vendorName: string): string {
  const name = vendorName.toLowerCase();
  if (name.includes('taco') || name.includes('rincón')) return 'Mexican';
  if (name.includes('pizza')) return 'Pizza';
  if (name.includes('bbq') || name.includes('bar-b-q')) return 'BBQ';
  if (name.includes('gyro') || name.includes('greek')) return 'Greek';
  if (name.includes('sushi') || name.includes('hibachi')) return 'Japanese';
  if (name.includes('indian') || name.includes('billu')) return 'Indian';
  if (name.includes('burger') || name.includes('hot dog')) return 'American';
  if (name.includes('deli')) return 'Deli';
  if (name.includes('ice cream')) return 'Dessert';
  if (name.includes('bulgogi') || name.includes('korean') || name.includes('mandu')) return 'Korean';
  if (name.includes('chinese') || name.includes('lotus')) return 'Asian';
  return 'Various';
}

// Current and upcoming food vendors from Lawrenceville
export const lawrencevilleFoodVendors: FoodVendor[] = [
  {
    id: 'lv-pure-grub-jan16',
    name: 'Pure Grub 412',
    date: '2025-01-16',
    startTime: '5:00 PM',
    endTime: '9:00 PM',
    website: 'https://www.instagram.com/puregrub412',
    location: Location.LAWRENCEVILLE,
    cuisine: 'American'
  },
  {
    id: 'lv-redeye-jan17',
    name: 'Redeye Bar-B-Q',
    date: '2025-01-17',
    website: 'https://www.instagram.com/redeye.bar.b.q',
    location: Location.LAWRENCEVILLE,
    cuisine: 'BBQ',
    featured: true
  },
  {
    id: 'lv-77club-jan18',
    name: '77 Club',
    date: '2025-01-18',
    website: 'https://www.instagram.com/77club_pgh',
    location: Location.LAWRENCEVILLE,
    cuisine: 'American'
  },
  {
    id: 'lv-412tacos-jan19',
    name: '412 Tacos',
    date: '2025-01-19',
    website: 'https://www.instagram.com/_412tacos',
    location: Location.LAWRENCEVILLE,
    cuisine: 'Mexican'
  },
  {
    id: 'lv-nickys-jan24',
    name: "Nicky's Hot Dogs",
    date: '2025-01-24',
    website: 'https://www.instagram.com/nickyshotdogs/',
    location: Location.LAWRENCEVILLE,
    cuisine: 'American'
  },
  {
    id: 'lv-affordable-jan25',
    name: 'Affordable Elegance',
    date: '2025-01-25',
    startTime: '4:00 PM',
    endTime: '10:00 PM',
    website: 'https://www.instagram.com/AffordableEleganceLLC',
    location: Location.LAWRENCEVILLE,
    cuisine: 'Various'
  },
  {
    id: 'lv-blackcat-jan31',
    name: 'Black Cat Pizza',
    date: '2025-01-31',
    website: 'https://www.instagram.com/blackcatpizzapa/',
    location: Location.LAWRENCEVILLE,
    cuisine: 'Pizza'
  },
  {
    id: 'lv-redeye-feb1',
    name: 'Redeye Bar-B-Q',
    date: '2025-02-01',
    website: 'https://www.instagram.com/redeye.bar.b.q',
    location: Location.LAWRENCEVILLE,
    cuisine: 'BBQ'
  },
  {
    id: 'lv-412tacos-feb2',
    name: '412 Tacos',
    date: '2025-02-02',
    website: 'https://www.instagram.com/_412tacos',
    location: Location.LAWRENCEVILLE,
    cuisine: 'Mexican'
  },
  {
    id: 'lv-pure-grub-feb6',
    name: 'Pure Grub 412',
    date: '2025-02-06',
    startTime: '5:00 PM',
    endTime: '9:00 PM',
    website: 'https://www.instagram.com/puregrub412',
    location: Location.LAWRENCEVILLE,
    cuisine: 'American'
  },
  {
    id: 'lv-blackcat-feb7',
    name: 'Black Cat Pizza',
    date: '2025-02-07',
    website: 'https://www.instagram.com/blackcatpizzapa/',
    location: Location.LAWRENCEVILLE,
    cuisine: 'Pizza'
  },
  {
    id: 'lv-hibachi-feb8',
    name: 'Hibachi Lou',
    date: '2025-02-08',
    website: 'https://www.instagram.com/hibachilou412',
    location: Location.LAWRENCEVILLE,
    cuisine: 'Japanese',
    featured: true
  },
  {
    id: 'lv-mandu-feb9',
    name: 'Mandu Handu',
    date: '2025-02-09',
    startTime: '4:00 PM',
    endTime: '8:00 PM',
    website: 'https://www.instagram.com/manduhandu/',
    location: Location.LAWRENCEVILLE,
    cuisine: 'Korean'
  },
  {
    id: 'lv-nickys-feb13',
    name: "Nicky's Hot Dogs",
    date: '2025-02-13',
    website: 'https://www.instagram.com/nickyshotdogs/',
    location: Location.LAWRENCEVILLE,
    cuisine: 'American'
  }
];

// Current and upcoming food vendors from Zelienople
export const zelienopleFoodVendors: FoodVendor[] = [
  {
    id: 'zel-aviva-may1',
    name: 'Aviva Brick Oven',
    date: '2025-05-01',
    startTime: '5:00 PM',
    endTime: '9:00 PM',
    website: 'https://www.instagram.com/avivabrickoven/',
    location: Location.ZELIENOPLE,
    cuisine: 'Pizza',
    featured: true
  },
  {
    id: 'zel-aviva-may2',
    name: 'Aviva Brick Oven',
    date: '2025-05-02',
    startTime: '5:00 PM',
    endTime: '9:00 PM',
    website: 'https://www.instagram.com/avivabrickoven/',
    location: Location.ZELIENOPLE,
    cuisine: 'Pizza'
  },
  {
    id: 'zel-aviva-may8',
    name: 'Aviva Brick Oven',
    date: '2025-05-08',
    website: 'https://www.instagram.com/avivabrickoven/',
    location: Location.ZELIENOPLE,
    cuisine: 'Pizza'
  },
  {
    id: 'zel-bulgogi-may9',
    name: 'Mr. Bulgogi',
    date: '2025-05-09',
    website: 'https://www.instagram.com/mrbulgogifoodtruck',
    location: Location.ZELIENOPLE,
    cuisine: 'Korean'
  },
  {
    id: 'zel-talkn-tacos-may10',
    name: "Talk'n Tacos",
    date: '2025-05-10',
    startTime: '4:00 PM',
    endTime: '9:00 PM',
    website: 'https://www.facebook.com/p/Talkn-Tacos-61560751041801/',
    location: Location.ZELIENOPLE,
    cuisine: 'Mexican'
  },
  {
    id: 'zel-meatman-may15',
    name: 'Meatman BBQ',
    date: '2025-05-15',
    website: 'https://www.facebook.com/meatmanbarbeque/',
    location: Location.ZELIENOPLE,
    cuisine: 'BBQ'
  },
  {
    id: 'zel-chubbys-may16',
    name: 'Chubbys Pizza Wagon',
    date: '2025-05-16',
    startTime: '5:00 PM',
    endTime: '9:00 PM',
    website: 'https://www.instagram.com/chubbys_pizza_wagon/',
    location: Location.ZELIENOPLE,
    cuisine: 'Pizza'
  },
  {
    id: 'zel-barbirou-may17',
    name: 'Barbirou Gyro',
    date: '2025-05-17',
    website: 'https://www.instagram.com/barbirou_greek_gyro_',
    location: Location.ZELIENOPLE,
    cuisine: 'Greek'
  },
  {
    id: 'zel-wild-lotus-may22',
    name: 'Wild Lotus',
    date: '2025-05-22',
    website: 'https://www.instagram.com/wildlotusft/',
    location: Location.ZELIENOPLE,
    cuisine: 'Asian'
  },
  {
    id: 'zel-papa-wood-may23',
    name: 'Papa Wood BBQ',
    date: '2025-05-23',
    website: 'https://www.instagram.com/papawoodbbq',
    location: Location.ZELIENOPLE,
    cuisine: 'BBQ',
    featured: true
  }
];

// Combine all food vendors
export const foodVendors: FoodVendor[] = [
  ...lawrencevilleFoodVendors,
  ...zelienopleFoodVendors
].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

export default foodVendors;