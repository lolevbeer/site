/**
 * Event Card Component
 * Wrapper around ScheduleCard for events
 */

'use client';

import React from 'react';
import { ScheduleCard } from '@/components/ui/schedule-card';
import { useLocationContext } from '@/components/location/location-provider';
import type { Event as PayloadEvent } from '@/src/payload-types';

// Accept both Payload events and legacy event formats
type EventInput = Partial<PayloadEvent> & {
  date: string;
  vendor?: string;
  title?: string;
  time?: string;
};

interface EventCardProps {
  event: EventInput;
  currentLocation?: string;
  className?: string;
}

export const EventCard = React.memo(function EventCard({
  event,
  currentLocation,
  className
}: EventCardProps) {
  const { locations } = useLocationContext();
  const displayName = event.organizer || event.vendor || event.title || 'Event';
  // Find location name from context or use the slug as fallback
  const location = locations.find(loc => (loc.slug || loc.id) === currentLocation);
  const locationName = location?.name || currentLocation || '';

  return (
    <ScheduleCard
      title={displayName}
      date={event.date}
      time={event.startTime ?? event.time ?? undefined}
      endTime={event.endTime ?? undefined}
      location={locationName}
      attendees={event.attendees ?? undefined}
      site={event.site ?? undefined}
      className={className}
    />
  );
});

export default EventCard;