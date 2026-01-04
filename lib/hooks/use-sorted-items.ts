'use client';

import { useMemo } from 'react';

type DateParser<T> = (item: T) => Date;

interface UseSortedItemsOptions<T> {
  /** Function to extract/parse date from item. Defaults to `new Date(item.date)` */
  getDate?: DateParser<T>;
  /** Maximum number of items to return. Defaults to 3 */
  limit?: number;
  /** Sort direction. Defaults to 'asc' (earliest first) */
  order?: 'asc' | 'desc';
}

/**
 * Hook to sort items by date and return a limited subset
 *
 * @param items - Array of items to sort
 * @param options - Configuration options
 * @returns Sorted and sliced array of items
 *
 * @example
 * // Basic usage - items with a `date` string field
 * const upcoming = useSortedItems(events, { limit: 3 });
 *
 * @example
 * // Custom date parser
 * const upcoming = useSortedItems(events, {
 *   getDate: (e) => parseLocalDate(e.date),
 *   limit: 5
 * });
 */
export function useSortedItems<T extends { date?: string }>(
  items: T[],
  options: UseSortedItemsOptions<T> = {}
): T[] {
  const {
    getDate = (item: T) => new Date(item.date || 0),
    limit = 3,
    order = 'asc',
  } = options;

  return useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const dateA = getDate(a);
      const dateB = getDate(b);
      const diff = dateA.getTime() - dateB.getTime();
      return order === 'asc' ? diff : -diff;
    });

    return sorted.slice(0, limit);
  }, [items, getDate, limit, order]);
}
