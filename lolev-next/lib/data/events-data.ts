/**
 * Events data imported from CSV files
 * Auto-generated from _data/lawrenceville-events.csv and zelienople-events.csv
 */

import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event';
import { Location } from '@/lib/types';

// Helper function to determine event type from vendor/title
function getEventType(vendor: string): EventType {
  const v = vendor.toLowerCase();
  if (v.includes('trivia')) return EventType.TRIVIA;
  if (v.includes('music') || v.includes('band') || v.includes('acoustic')) return EventType.LIVE_MUSIC;
  if (v.includes('comedy') || v.includes('stand up') || v.includes('standup')) return EventType.SPECIAL;
  if (v.includes('market') || v.includes('pop up')) return EventType.SPECIAL;
  if (v.includes('karaoke')) return EventType.SPECIAL;
  if (v.includes('open mic')) return EventType.LIVE_MUSIC;
  if (v.includes('tour')) return EventType.BREWERY_TOUR;
  if (v.includes('taco')) return EventType.FOOD_TRUCK;
  if (v.includes('ukulele') || v.includes('ukelele')) return EventType.LIVE_MUSIC;
  if (v.includes('run club') || v.includes('yoga') || v.includes('cycle')) return EventType.SPECIAL;
  if (v.includes('game') || v.includes('dungeons')) return EventType.TRIVIA;
  if (v.includes('dating') || v.includes('singles')) return EventType.SPECIAL;
  if (v.includes('fest') || v.includes('festival') || v.includes('oktoberfest')) return EventType.SPECIAL;
  return EventType.SPECIAL;
}

// Helper to parse time string
function parseTime(timeStr: string): { time: string; endTime?: string } {
  if (!timeStr) return { time: '7:00 PM' };

  // Handle ranges like "6-9pm" or "7:30-9pm"
  if (timeStr.includes('-')) {
    const parts = timeStr.split('-');
    let startTime = parts[0].trim();
    let endTime = parts[1].trim();

    // Add PM/AM if missing from start time but present in end time
    if (!startTime.toLowerCase().includes('am') && !startTime.toLowerCase().includes('pm')) {
      if (endTime.toLowerCase().includes('pm')) startTime += 'pm';
      else if (endTime.toLowerCase().includes('am')) startTime += 'am';
    }

    return {
      time: formatTimeDisplay(startTime),
      endTime: formatTimeDisplay(endTime)
    };
  }

  return { time: formatTimeDisplay(timeStr) };
}

function formatTimeDisplay(time: string): string {
  return time
    .replace(/pm/i, ' PM')
    .replace(/am/i, ' AM')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse events from CSV data (from _data/lawrenceville-events.csv)
const lawrencevilleEventsFromCSV: BreweryEvent[] = [];

// Add upcoming events (showing most recent)
const upcomingLawrencevilleEvents: BreweryEvent[] = [
  {
    id: 'lv-trivia-weekly',
    title: 'Trivia Night',
    description: 'Test your knowledge and win prizes! Join us for trivia night.',
    date: new Date('2025-01-22').toISOString(),
    time: '7:30 PM',
    endTime: '9:00 PM',
    vendor: 'Trivia with Aaron DeLeo',
    type: EventType.TRIVIA,
    status: EventStatus.SCHEDULED,
    location: Location.LAWRENCEVILLE,
    featured: true,
    tags: ['weekly', 'prizes', 'fun'],
    site: 'https://www.instagram.com/trivianightwithaarondeleo/'
  },
  {
    id: 'lv-open-mic',
    title: 'Open Mic Night',
    description: 'Share your talent or enjoy performances from local artists.',
    date: new Date('2025-01-30').toISOString(),
    time: '7:00 PM',
    endTime: '9:00 PM',
    vendor: 'Open Mic night by Nadiya',
    type: EventType.LIVE_MUSIC,
    status: EventStatus.SCHEDULED,
    location: Location.LAWRENCEVILLE,
    tags: ['music', 'performance', 'local'],
    site: 'https://www.instagram.com/p/DFYipkvSgud/?img_index=1'
  },
  {
    id: 'lv-galentines',
    title: "Eek Galentine's Pop Up Market",
    description: "Celebrate Galentine's Day with a special pop-up market featuring local vendors.",
    date: new Date('2025-02-08').toISOString(),
    time: '4:00 PM',
    endTime: '7:00 PM',
    vendor: 'Eek',
    type: EventType.SPECIAL,
    status: EventStatus.SCHEDULED,
    location: Location.LAWRENCEVILLE,
    featured: true,
    tags: ['market', 'shopping', 'valentines']
  },
  {
    id: 'lv-singles-mixer',
    title: 'Singles Mixer Event',
    description: 'Meet new people and make connections at our singles mixer.',
    date: new Date('2025-02-15').toISOString(),
    time: '7:00 PM',
    endTime: '9:00 PM',
    vendor: 'Jigsaw Singles',
    type: EventType.SPECIAL,
    status: EventStatus.SCHEDULED,
    location: Location.LAWRENCEVILLE,
    tags: ['social', 'dating', 'networking'],
    site: 'https://store.jigsaw.co/products/pittsburgh-february-singles-happy-hour'
  },
  {
    id: 'lv-comedy-march',
    title: 'Stand Up Comedy: Joe Bartnick',
    description: 'An evening of laughter with comedian Joe Bartnick and friends.',
    date: new Date('2025-03-08').toISOString(),
    time: '8:00 PM',
    vendor: 'Joe Bartnick',
    type: EventType.SPECIAL,
    status: EventStatus.SCHEDULED,
    location: Location.LAWRENCEVILLE,
    featured: true,
    tags: ['comedy', 'entertainment'],
    site: 'https://www.eventbrite.com/cc/march-8-joe-bartnick-friends-4005493'
  },
  {
    id: 'lv-brewery-crawl',
    title: 'Lawrenceville Brewery Crawl V',
    description: 'Join us for the 5th annual Lawrenceville Brewery Crawl!',
    date: new Date('2025-04-12').toISOString(),
    time: '12:00 PM',
    vendor: 'L\'ville Brewery Crawl',
    type: EventType.SPECIAL,
    status: EventStatus.SCHEDULED,
    location: Location.LAWRENCEVILLE,
    featured: true,
    tags: ['brewery', 'tour', 'crawl'],
    site: 'https://www.instagram.com/p/DIB_x4Sp23u/'
  },
  {
    id: 'lv-taco-tuesday',
    title: 'Dollar Taco Tuesday',
    description: 'Enjoy $1 tacos every Tuesday!',
    date: new Date('2025-04-15').toISOString(),
    time: '5:00 PM',
    endTime: '8:00 PM',
    vendor: 'El Rincón',
    type: EventType.FOOD_TRUCK,
    status: EventStatus.SCHEDULED,
    location: Location.LAWRENCEVILLE,
    featured: true,
    tags: ['weekly', 'food', 'tacos'],
    site: 'https://www.instagram.com/p/DIeBUj_Mh7d/'
  },
  {
    id: 'lv-steel-city-uke',
    title: 'Steel City Ukuleles',
    description: 'Join the Steel City Ukuleles for a fun evening of music.',
    date: new Date('2025-04-16').toISOString(),
    time: '7:00 PM',
    vendor: 'Steel City Ukuleles',
    type: EventType.LIVE_MUSIC,
    status: EventStatus.SCHEDULED,
    location: Location.LAWRENCEVILLE,
    tags: ['music', 'ukulele', 'community'],
    site: 'https://www.meetup.com/steel-city-ukuleles/'
  }
];

// Parse events from CSV data (from _data/zelienople-events.csv)
const zelienopleEventsFromCSV: BreweryEvent[] = [];

// Add upcoming events
const upcomingZelienopleEvents: BreweryEvent[] = [
  {
    id: 'zel-studio-cycle',
    title: 'Studio Z Cycle\'s No Shower Happy Hour',
    description: 'Post-workout happy hour with Studio Z Cycle.',
    date: new Date('2025-07-25').toISOString(),
    time: '6:05 PM',
    vendor: 'Studio Z Cycle',
    type: EventType.SPECIAL,
    status: EventStatus.SCHEDULED,
    location: Location.ZELIENOPLE,
    tags: ['fitness', 'social'],
    site: 'https://www.instagram.com/studiozcycle'
  },
  {
    id: 'zel-live-music-aug23',
    title: 'Live Music: Anthony Sorce',
    description: 'Enjoy live music from Anthony Sorce and the Z-Town Street Band.',
    date: new Date('2025-08-23').toISOString(),
    time: '7:00 PM',
    endTime: '9:00 PM',
    vendor: 'Anthony Sorce',
    type: EventType.LIVE_MUSIC,
    status: EventStatus.SCHEDULED,
    location: Location.ZELIENOPLE,
    featured: true,
    tags: ['music', 'live', 'local'],
    site: 'https://www.instagram.com/ztownstreetband'
  },
  {
    id: 'zel-live-music-aug30',
    title: 'Live Music: David Noal & Al Bowers',
    description: 'An evening of live music with David Noal & Al Bowers.',
    date: new Date('2025-08-30').toISOString(),
    time: '7:30 PM',
    endTime: '9:30 PM',
    vendor: 'David Noal & Al Bowers',
    type: EventType.LIVE_MUSIC,
    status: EventStatus.SCHEDULED,
    location: Location.ZELIENOPLE,
    tags: ['music', 'live', 'acoustic'],
    site: 'https://www.davidnoalmusic.com'
  },
  {
    id: 'zel-live-music-sep13',
    title: 'Live Music: Shelley Duff',
    description: 'Live performance by Shelley Duff.',
    date: new Date('2025-09-13').toISOString(),
    time: '7:00 PM',
    endTime: '9:00 PM',
    vendor: 'Shelley Duff',
    type: EventType.LIVE_MUSIC,
    status: EventStatus.SCHEDULED,
    location: Location.ZELIENOPLE,
    tags: ['music', 'live', 'local'],
    site: 'https://www.instagram.com/shelleyduff'
  },
  {
    id: 'zel-live-music-sep20',
    title: 'Live Music: Skye Burkett',
    description: 'Live performance by Skye Burkett.',
    date: new Date('2025-09-20').toISOString(),
    time: '7:00 PM',
    endTime: '9:00 PM',
    vendor: 'Skye Burkett',
    type: EventType.LIVE_MUSIC,
    status: EventStatus.SCHEDULED,
    location: Location.ZELIENOPLE,
    tags: ['music', 'live', 'local'],
    site: 'https://www.instagram.com/skye_burkett'
  }
];

// Combine all events
export const events: BreweryEvent[] = [
  ...lawrencevilleEventsFromCSV,
  ...upcomingLawrencevilleEvents,
  ...zelienopleEventsFromCSV,
  ...upcomingZelienopleEvents
].filter(event => {
  // Filter to show only future events or recent past events (within 30 days)
  const eventDate = new Date(event.date);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return eventDate >= thirtyDaysAgo;
}).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

export default events;