/**
 * Unified formatting utilities
 * Consolidates all formatting functions used across the application
 */

import { GlassType, Beer } from '@/lib/types/beer';
import { EventType, EventStatus } from '@/lib/types/event';
import { CuisineType, DietaryOption, FoodVendorType } from '@/lib/types/food';

/**
 * Time formatting utilities
 */
export function formatTime(timeString: string): string {
  if (!timeString) return '';

  // Handle various formats (e.g., "7pm", "7:00 PM", "19:00")
  try {
    if (timeString.includes(':')) {
      const [time, period] = timeString.split(/\s*(AM|PM|am|pm)\s*/);
      if (period) {
        return timeString.toLowerCase();
      }
      // 24-hour format
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'pm' : 'am';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes}${ampm}`;
    }
    return timeString.toLowerCase();
  } catch {
    return timeString;
  }
}

export function format24to12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export function parseTimeRange(timeString: string): { time: string; endTime?: string } {
  if (!timeString) return { time: '' };

  // Handle time ranges like "7pm-10pm" or "7:00 PM - 10:00 PM"
  const rangeSeparators = [' - ', '-', ' to ', '–'];

  for (const separator of rangeSeparators) {
    if (timeString.includes(separator)) {
      const [startTime, endTime] = timeString.split(separator).map(t => t.trim());
      return {
        time: formatTime(startTime),
        endTime: formatTime(endTime)
      };
    }
  }

  // Single time, no range
  return { time: formatTime(timeString) };
}

/**
 * Date formatting utilities
 */
export function formatDate(dateString: string, format: 'short' | 'long' | 'full' = 'short'): string {
  const date = new Date(dateString);

  switch (format) {
    case 'full':
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'long':
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric'
      });
    case 'short':
    default:
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
  }
}

/**
 * Price formatting utilities
 */
export function formatPrice(price: number | undefined): string {
  if (!price) return '';
  return `$${price.toFixed(2).replace(/\.00$/, '')}`;
}

export function formatPriceRange(priceRange?: number): string {
  if (!priceRange) return '';
  return '$'.repeat(Math.min(priceRange, 4));
}

/**
 * Beer-specific formatters
 */
export function formatAbv(abv: number): string {
  return `${abv.toFixed(1)}%`;
}

export function getBeerSlug(beer: Beer): string {
  return beer.variant.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function getBeerAvailability(beer: Beer): string {
  const availability = [];

  if (beer.availability.tap) {
    availability.push(`Tap ${beer.availability.tap}`);
  }
  if (beer.availability.cansAvailable) {
    availability.push('Cans');
  }
  if (beer.availability.singleCanAvailable) {
    availability.push('Singles');
  }

  return availability.length > 0 ? availability.join(' • ') : 'Limited';
}

export function getBeerPricing(beer: Beer): string {
  const pricing = [];

  if (beer.pricing.draftPrice) {
    pricing.push(`Draft ${formatPrice(beer.pricing.draftPrice)}`);
  }
  if (beer.pricing.canSingle || beer.pricing.cansSingle) {
    const singlePrice = beer.pricing.canSingle || beer.pricing.cansSingle;
    pricing.push(`Single ${formatPrice(singlePrice)}`);
  }
  if (beer.pricing.fourPack) {
    pricing.push(`4-Pack ${formatPrice(beer.pricing.fourPack)}`);
  }

  return pricing.length > 0 ? pricing.join(' • ') : 'See store';
}

/**
 * Event-specific formatters
 */
export function formatEventType(type: EventType): string {
  return String(type).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getEventStatusVariant(status: EventStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case EventStatus.CANCELLED:
      return 'destructive';
    case EventStatus.SOLD_OUT:
      return 'secondary';
    case EventStatus.POSTPONED:
      return 'outline';
    default:
      return 'default';
  }
}

export function formatEventStatus(status: EventStatus): string {
  return status.replace('_', ' ').toUpperCase();
}

/**
 * Food vendor formatters
 */
export function formatCuisineType(cuisine: CuisineType): string {
  if (!cuisine) return 'Street Food';
  return String(cuisine).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function formatDietaryOption(option: DietaryOption): string {
  if (!option) return '';
  return String(option).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function formatVendorType(type: FoodVendorType): string {
  if (!type) return 'Food Truck';
  return String(type).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Generic enum formatter
 */
export function formatEnum(value: string | undefined, defaultValue = ''): string {
  if (!value) return defaultValue;
  return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Glass type icon mapper
 */
export function getGlassTypeIcon(glass: GlassType): string {
  switch (glass) {
    case GlassType.PINT:
      return 'beer';
    case GlassType.TEKU:
      return 'wine';
    case GlassType.STEIN:
      return 'glass-water';
    default:
      return 'beer';
  }
}