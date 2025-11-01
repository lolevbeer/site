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
export function formatTime(timeString: string, options: { compact?: boolean } = {}): string {
  if (!timeString) return '';

  try {
    // Handle already formatted 12-hour time (e.g., "7:00 PM", "7pm")
    const match12h = timeString.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)/i);
    if (match12h) {
      const hour = parseInt(match12h[1]);
      const mins = parseInt(match12h[2] || '0');
      const ampm = match12h[3].toLowerCase();
      return mins === 0 && options.compact
        ? `${hour}${ampm}`
        : `${hour}:${mins.toString().padStart(2, '0')}${ampm}`;
    }

    // Handle 24-hour format (e.g., "19:00")
    const match24h = timeString.match(/(\d{1,2}):(\d{2})/);
    if (match24h) {
      const hour = parseInt(match24h[1]);
      const mins = parseInt(match24h[2]);
      const ampm = hour >= 12 ? 'pm' : 'am';
      const hour12 = hour % 12 || 12;
      return mins === 0 && options.compact
        ? `${hour12}${ampm}`
        : `${hour12}:${mins.toString().padStart(2, '0')}${ampm}`;
    }

    return timeString.toLowerCase();
  } catch {
    return timeString;
  }
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

/**
 * Parse a date string in YYYY-MM-DD format without timezone conversion
 * This prevents dates from shifting due to timezone offsets
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(dateString: string, format: 'short' | 'long' | 'full' = 'short'): string {
  const date = parseLocalDate(dateString);

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
    pricing.push(`4 Pack ${formatPrice(beer.pricing.fourPack)}`);
  }

  return pricing.length > 0 ? pricing.join(' • ') : 'See store';
}

/**
 * Generic enum formatter - converts SNAKE_CASE to Title Case
 */
export function formatEnum(value: string | undefined, defaultValue = ''): string {
  if (!value) return defaultValue;
  return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Event-specific formatters
 */
export const formatEventType = (type: EventType) => formatEnum(String(type));
export const formatEventStatus = (status: EventStatus) => formatEnum(status).toUpperCase();

export function getEventStatusVariant(status: EventStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<EventStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    [EventStatus.CANCELLED]: 'destructive',
    [EventStatus.SOLD_OUT]: 'secondary',
    [EventStatus.POSTPONED]: 'outline',
    [EventStatus.SCHEDULED]: 'default',
    [EventStatus.COMPLETED]: 'default',
    [EventStatus.DRAFT]: 'outline',
  };
  return variants[status] || 'default';
}

/**
 * Food vendor formatters
 */
export const formatCuisineType = (cuisine: CuisineType) => formatEnum(String(cuisine), 'Street Food');
export const formatDietaryOption = (option: DietaryOption) => formatEnum(String(option));
export const formatVendorType = (type: FoodVendorType) => formatEnum(String(type), 'Food Truck');

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