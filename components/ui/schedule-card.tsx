/**
 * Schedule Card Component
 * Reusable card for events, food vendors, and other scheduled items
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
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
  return (
    <Card
      className={`overflow-hidden border-0 shadow-none transition-colors ${site ? 'cursor-pointer hover:bg-secondary' : ''} ${className || ''}`}
      onClick={() => site && window.open(site, '_blank')}
    >
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(date, 'full')}</span>
          </div>
          {time && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                {formatTime(time.trim())}
                {endTime && `-${formatTime(endTime.trim())}`}
              </span>
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{location}</span>
            </div>
          )}
          {attendees && attendees !== '' && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{attendees} attending</span>
            </div>
          )}
          {additionalInfo}
        </div>
      </CardContent>
    </Card>
  );
}

export default ScheduleCard;
