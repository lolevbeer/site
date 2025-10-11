'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { BreweryEvent } from '@/lib/types/event';
import { EventList } from '@/components/events/event-list';
import { Button } from '@/components/ui/button';
import { Mail, Phone } from 'lucide-react';
import { loadEventsFromCSV } from '@/lib/utils/events';
import { useLocationContext } from '@/components/location/location-provider';

interface EventsPageContentProps {
  initialEvents?: BreweryEvent[];
}

export function EventsPageContent({ initialEvents = [] }: EventsPageContentProps) {
  const { currentLocation, setLocation } = useLocationContext();
  const [events, setEvents] = useState<BreweryEvent[]>(initialEvents);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const csvEvents = await loadEventsFromCSV();
        if (csvEvents.length > 0) {
          setEvents(csvEvents);
        }
      } catch (error) {
        console.error('Error loading events:', error);
        // Keep initial events if CSV loading fails
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);
  const handleEventClick = (event: BreweryEvent) => {
    if (event.site) {
      window.open(event.site, '_blank');
    }
  };

  // Filter events by location with useMemo to ensure proper updates
  const filteredEvents = useMemo(() => {
    console.log('Filtering events for location:', currentLocation);
    return currentLocation === 'all'
      ? events
      : events.filter(event => event.location === currentLocation);
  }, [events, currentLocation]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Events</h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading events...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No upcoming events at this location.
        </div>
      ) : (
        <EventList
          key={`events-${currentLocation}`}
          events={filteredEvents}
          onEventClick={handleEventClick}
          showLocationFilter={false}
          showFilters={false}
        />
      )}

      <div className="text-center space-y-3 pt-12 mt-12">
        <h2 className="text-lg font-semibold">Book Private Event</h2>
        <div className="flex justify-center gap-4 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <a href="mailto:events@lolev.beer">
              events@lolev.beer
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="tel:4123368965">
              (412) 336-8965
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}