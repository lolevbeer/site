/**
 * Timeline Item Component
 * A visually engaging item for timeline displays
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/utils/formatters';

interface TimelineItemProps {
  title: string;
  time?: string;
  endTime?: string;
  location?: string;
  description?: string;
  site?: string;
  imageUrl?: string;
  className?: string;
}

export function TimelineItem({
  title,
  time,
  endTime,
  location,
  description,
  site,
  imageUrl,
  className
}: TimelineItemProps) {
  const handleClick = () => {
    if (site) {
      window.open(site, '_blank');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (site && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      window.open(site, '_blank');
    }
  };

  const hasTime = time && time.toLowerCase() !== 'tbd';

  const timeDisplay = hasTime ? (
    endTime && endTime.toLowerCase() !== 'tbd'
      ? `${formatTime(time)}–${formatTime(endTime)}`
      : formatTime(time)
  ) : null;

  return (
    <div
      className={cn(
        'group relative flex items-stretch gap-4 p-4 rounded-lg',
        'transition-all duration-200',
        site
          ? 'border border-border cursor-pointer hover:bg-secondary hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          : 'border-transparent',
        className
      )}
      onClick={site ? handleClick : undefined}
      onKeyDown={site ? handleKeyDown : undefined}
      tabIndex={site ? 0 : undefined}
      role={site ? 'link' : undefined}
    >
      {/* Image */}
      {imageUrl && (
        <div className="relative w-12 h-12 flex-shrink-0 rounded-full overflow-hidden bg-muted">
          <Image
            src={imageUrl}
            alt={`${title} logo`}
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
      )}
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-base leading-tight">
          {title}
        </h4>
        {(location || timeDisplay) && (
          <p className="text-sm text-muted-foreground mt-1">
            {location}
            {location && timeDisplay && ' • '}
            {timeDisplay}
          </p>
        )}
        {description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default TimelineItem;
