/**
 * Timeline List Component
 * A visually engaging timeline display for date-based items (events, food, etc.)
 */

'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatDate, isToday, isTomorrow } from '@/lib/utils/formatters';

interface TimelineItemBase {
  id?: string;
  date: string;
}

interface TimelineListProps<T extends TimelineItemBase> {
  items: T[];
  renderItem: (item: T, isFirst: boolean) => React.ReactNode;
  className?: string;
  emptyState?: React.ReactNode;
}

/**
 * Groups items by date and renders them in a timeline format
 */
export function TimelineList<T extends TimelineItemBase>({
  items,
  renderItem,
  className,
  emptyState
}: TimelineListProps<T>) {
  // Group items by date
  const groupedItems = useMemo(() => {
    const groups: { date: string; label: string; items: T[] }[] = [];
    const dateMap = new Map<string, T[]>();

    for (const item of items) {
      const dateKey = item.date.split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(item);
    }

    // Sort dates and create groups
    const sortedDates = Array.from(dateMap.keys()).sort();

    for (const dateKey of sortedDates) {
      const dateItems = dateMap.get(dateKey)!;
      let label: string;

      if (isToday(dateKey)) {
        label = 'Today';
      } else if (isTomorrow(dateKey)) {
        label = 'Tomorrow';
      } else {
        label = formatDate(dateKey, 'full');
      }

      groups.push({ date: dateKey, label, items: dateItems });
    }

    return groups;
  }, [items]);

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn('relative', className)}>
      {groupedItems.map((group, groupIndex) => {
        const isTodayGroup = isToday(group.date);

        return (
          <div
            key={group.date}
            className={cn(
              'relative',
              groupIndex > 0 && 'mt-8'
            )}
          >
            {/* Date Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 mb-4">
              <div className="flex items-center gap-3">
                <h3 className={cn(
                  'text-lg font-semibold tracking-tight',
                  isTodayGroup && 'text-primary'
                )}>
                  {group.label}
                </h3>
                <div className="flex-1 h-px bg-border" />
              </div>
            </div>

            {/* Items for this date */}
            <div className="space-y-3">
              {group.items.map((item, itemIndex) => (
                <div
                  key={item.id || `${group.date}-${itemIndex}`}
                  className="animate-in fade-in-0 slide-in-from-left-2 duration-300"
                  style={{ animationDelay: `${Math.min(itemIndex * 50, 200)}ms` }}
                >
                  {renderItem(item, itemIndex === 0)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TimelineList;
