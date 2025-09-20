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
import { Calendar, List, Clock, MapPin, Star } from 'lucide-react';
import { loadEventsFromCSV } from '@/lib/utils/events';

interface EventsPageContentProps {
  initialEvents?: BreweryEvent[];
}

export function EventsPageContent({ initialEvents = [] }: EventsPageContentProps) {
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
    // Handle event details view
    console.log('Event clicked:', event);
  };

  const upcomingEvents = events.filter(event =>
    new Date(event.date) >= new Date() && event.status === EventStatus.SCHEDULED
  );

  const featuredEvents = upcomingEvents.filter(event => event.featured);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Events at Love of Lev
        </h1>
        <p className="text-xl mx-auto">
          Join us for unforgettable experiences, from trivia nights to live music,
          brewery tours to special celebrations.
        </p>
      </div>

      {/* Featured Events */}
      {featuredEvents.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-600" />
            Featured Events
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredEvents.map(event => (
              <div key={event.id} className="relative">
                <div className="absolute -top-2 -right-2 z-10">
                  <Badge className="bg-yellow-500 text-yellow-900">
                    Featured
                  </Badge>
                </div>
                <EventCard
                  event={event}
                  variant="featured"
                  onEventClick={handleEventClick}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All Events */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">All Events</h2>
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-0">
            <EventList
              events={events}
              onEventClick={handleEventClick}
              showLocationFilter={true}
              showFilters={true}
            />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-0">
            <EventCalendar
              events={events}
              onEventClick={handleEventClick}
              showLocationFilter={true}
              showAddEvent={false}
            />
          </TabsContent>
        </Tabs>
      </section>

      {/* Event Types Info */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Event Types</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">🎯 Trivia Night</h3>
            <p className="text-sm">
              Test your knowledge every Wednesday at 7 PM
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">🎵 Live Music</h3>
            <p className="text-sm">
              Enjoy local bands every Friday and Saturday
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">🍺 Brewery Tours</h3>
            <p className="text-sm">
              Behind-the-scenes tours on weekends
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">🍔 Food Trucks</h3>
            <p className="text-sm">
              Different food trucks throughout the week
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">🎉 Special Events</h3>
            <p className="text-sm">
              Beer releases, holiday parties, and more
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">📚 Educational</h3>
            <p className="text-sm">
              Beer tasting classes and brewing workshops
            </p>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="text-center space-y-4 pt-8 border-t">
        <h2 className="text-2xl font-bold">Book Your Event</h2>
        <p>
          Looking to host your next celebration at Love of Lev? We offer private event
          spaces and custom beer packages for parties, corporate events, and special occasions.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Badge variant="outline">📧 info@lolev.beer</Badge>
          <Badge variant="outline">📱 (412) 336-8965</Badge>
        </div>
      </section>
    </div>
  );
}