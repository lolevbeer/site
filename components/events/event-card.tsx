/**
 * Event Card Component
 * Wrapper around ScheduleCard for events
 */

'use client';

import React from 'react';
import { ScheduleCard } from '@/components/ui/schedule-card';
import { useLocationContext } from '@/components/location/location-provider';

interface EventCardProps {
  event: {
    vendor?: string;
    title?: string;
    date: string;
    time?: string;
    endTime?: string;
    location?: string;
    attendees?: string | number;
    site?: string;
  };
  currentLocation?: string;
  className?: string;
}

export const EventCard = React.memo(function EventCard({
  event,
  currentLocation,
  className
}: EventCardProps) {
  const { locations } = useLocationContext();
  const displayName = event.vendor || event.title || 'Event';
  // Find location name from context or use the slug as fallback
  const location = locations.find(loc => (loc.slug || loc.id) === currentLocation);
  const locationName = location?.name || currentLocation || '';

  return (
    <ScheduleCard
      title={displayName}
      date={event.date}
      time={event.time}
      endTime={event.endTime}
      location={locationName}
      attendees={event.attendees}
      site={event.site}
      className={className}
    />
  );
});

export default EventCard;