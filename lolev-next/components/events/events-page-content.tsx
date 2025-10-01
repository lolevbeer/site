/**
 * Events Page Content Component
 * Client component for interactive events functionality
 */

'use client';

import React, { useEffect, useState } from 'react';
import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event';
import { Location } from '@/lib/types/location';
import { EventList } from '@/components/events/event-list';
import { EventCalendar } from '@/components/events/event-calendar';
import { EventCard } from '@/components/events/event-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, List, Clock, MapPin, Mail, Phone } from 'lucide-react';
import { loadEventsFromCSV } from '@/lib/utils/events';
import { LocationDisplayNames } from '@/lib/types/location';
import { useLocationContext } from '@/components/location/location-provider';

interface EventsPageContentProps {
  initialEvents?: BreweryEvent[];
}

export function EventsPageContent({ initialEvents = [] }: EventsPageContentProps) {
  const { currentLocation, setLocation } = useLocationContext();
  const [events, setEvents] = useState<BreweryEvent[]>(initialEvents);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | 'all'>(currentLocation);

  // Update local state when global location changes
  useEffect(() => {
    setSelectedLocation(currentLocation);
  }, [currentLocation]);

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
    // Handle event details view
    console.log('Event clicked:', event);
  };

  // Filter events by location
  const filteredEvents = selectedLocation === 'all'
    ? events
    : events.filter(event => event.location === selectedLocation);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Events
        </h1>
        <p className="text-xl mx-auto">
          Join us for unforgettable experiences, from trivia nights to live music,
          brewery tours to special celebrations.
        </p>
      </div>

      {/* Upcoming Events */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Upcoming Events</h2>
        <Tabs defaultValue="list" className="w-full">
          <div className="flex justify-center mb-4">
            {/* View Switcher */}
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                List View
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Calendar View
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="list" className="space-y-0">
            <EventList
              events={filteredEvents}
              onEventClick={handleEventClick}
              showLocationFilter={false}
              showFilters={true}
              selectedLocation={selectedLocation}
              onLocationChange={(location) => {
                setSelectedLocation(location);
                // Update global location if a specific location is selected
                if (location !== 'all') {
                  setLocation(location);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-0">
            <EventCalendar
              events={filteredEvents}
              onEventClick={handleEventClick}
              showLocationFilter={false}
              showAddEvent={false}
              selectedLocation={selectedLocation}
              onLocationChange={(location) => {
                setSelectedLocation(location);
                // Update global location if a specific location is selected
                if (location !== 'all') {
                  setLocation(location);
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </section>

      {/* Contact Section */}
      <section className="text-center space-y-4 pt-8 border-t">
        <h2 className="text-2xl font-bold">Book Your Event</h2>
        <p>
          Looking to host your next celebration at Lolev?
        </p>
        <p>
          We offer private event spaces and custom beer packages for parties, corporate events, and special occasions.
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" asChild>
            <a href="mailto:info@lolev.beer" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              info@lolev.beer
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="tel:4123368965" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              (412) 336-8965
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}