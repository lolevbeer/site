/**
 * Schedule Card Component
 * Reusable card for events, food vendors, and other scheduled items
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatTime, formatDate } from '@/lib/utils/formatters';

interface ScheduleCardProps {
  title: string;
  date: string;
  time?: string;
  endTime?: string;
  location?: string;
  attendees?: string | number;
  site?: string;
  className?: string;
  additionalInfo?: React.ReactNode;
}

export function ScheduleCard({
  title,
  date,
  time,
  endTime,
  location,
  attendees,
  site,
  className,
  additionalInfo
}: ScheduleCardProps) {
  const handleClick = () => site && window.open(site, '_blank');
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (site && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      window.open(site, '_blank');
    }
  };

  return (
    <Card
      className={`overflow-hidden border border-border shadow-none transition-colors bg-transparent ${site ? 'cursor-pointer hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' : ''} ${className || ''}`}
      onClick={handleClick}
      onKeyDown={site ? handleKeyDown : undefined}
      tabIndex={site ? 0 : undefined}
      role={site ? 'link' : undefined}
      aria-label={site ? `${title} - opens in new window` : undefined}
    >
      <CardContent className="p-6 text-center">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>

        <div className="space-y-1 text-sm text-muted-foreground flex flex-col items-center">
          <span>{formatDate(date, 'full')}</span>
          {time && time.toLowerCase() !== 'tbd' && (
            <span>
              {formatTime(time.trim())}
              {endTime && endTime.toLowerCase() !== 'tbd' && `–${formatTime(endTime.trim())}`}
            </span>
          )}
          {location && <span>{location}</span>}
          {attendees && attendees !== '' && <span>{attendees} attending</span>}
          {additionalInfo}
        </div>
      </CardContent>
    </Card>
  );
}

export default ScheduleCard;
