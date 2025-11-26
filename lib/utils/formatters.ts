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
function convertTo12Hour(hour: number, mins: number, compact = false): string {
  const ampm = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  return mins === 0 && compact ? `${hour12}${ampm}` : `${hour12}:${mins.toString().padStart(2, '0')}${ampm}`;
}

export function formatTime(timeString: string, options: { compact?: boolean } = {}): string {
  if (!timeString) return '';

  const match12h = timeString.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)/i);
  if (match12h) {
    return convertTo12Hour(parseInt(match12h[1]), parseInt(match12h[2] || '0'), options.compact);
  }

  const match24h = timeString.match(/(\d{1,2}):(\d{2})/);
  if (match24h) {
    return convertTo12Hour(parseInt(match24h[1]), parseInt(match24h[2]), options.compact);
  }

  return timeString.toLowerCase();
}

export function parseTimeRange(timeString: string): { time: string; endTime?: string } {
  if (!timeString) return { time: '' };

  const parts = timeString.split(/\s*(?:-|–| to )\s*/);
  if (parts.length === 2) {
    return { time: formatTime(parts[0]), endTime: formatTime(parts[1]) };
  }

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
export function formatAbv(abv: number, includeLabel = false): string {
  return `${abv.toFixed(1)}%${includeLabel ? ' ABV' : ''}`;
}

/**
 * Date comparison helpers for filtering events/schedules
 */
export function isToday(dateString: string): boolean {
  const date = parseLocalDate(dateString.split('T')[0]);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function isFuture(dateString: string): boolean {
  const date = parseLocalDate(dateString.split('T')[0]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
}

export function isTodayOrFuture(dateString: string): boolean {
  const date = parseLocalDate(dateString.split('T')[0]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() >= today.getTime();
}

export function partitionByDate<T extends { date: string }>(
  items: T[]
): { today: T[]; upcoming: T[] } {
  return {
    today: items.filter(item => isToday(item.date)),
    upcoming: items.filter(item => isFuture(item.date)),
  };
}

export function getBeerSlug(beer: Beer): string {
  return beer.variant.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function getBeerAvailability(beer: Beer): string {
  const items = [
    beer.availability.tap && `Tap ${beer.availability.tap}`,
    beer.availability.cansAvailable && 'Cans',
    beer.availability.singleCanAvailable && 'Singles'
  ].filter(Boolean);
  return items.length > 0 ? items.join(' • ') : 'Limited';
}

export function getBeerPricing(beer: Beer): string {
  const items = [
    beer.pricing.draftPrice && `Draft ${formatPrice(beer.pricing.draftPrice)}`,
    (beer.pricing.canSingle || beer.pricing.cansSingle) && `Single ${formatPrice(beer.pricing.canSingle || beer.pricing.cansSingle)}`,
    beer.pricing.fourPack && `4 Pack ${formatPrice(beer.pricing.fourPack)}`
  ].filter(Boolean);
  return items.length > 0 ? items.join(' • ') : 'See store';
}

/**
 * Generic enum formatter - converts SNAKE_CASE to Title Case
 */
export function formatEnum(value: string | undefined, defaultValue = ''): string {
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : defaultValue;
}

/**
 * Event-specific formatters
 */
export const formatEventType = (type: EventType) => formatEnum(String(type));
export const formatEventStatus = (status: EventStatus) => formatEnum(status);

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