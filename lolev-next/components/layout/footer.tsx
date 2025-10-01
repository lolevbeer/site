'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SocialLinks } from './social-links';
import { Logo } from '@/components/ui/logo';
import { Location, LocationDisplayNames, type LocationInfo, type LocationHours } from '@/lib/types';
import { LOCATIONS_DATA } from '@/lib/config/locations';
import { MapPin, Clock, Phone, Mail, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocationContext } from '@/components/location/location-provider';
import { format24to12Hour } from '@/lib/utils/formatters';

/**
 * Get day name from hours key
 */
function getDayName(day: keyof LocationHours): string {
  const dayNames = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };
  return dayNames[day];
}

/**
 * Hours display component
 */
function HoursDisplay({ hours }: { hours: LocationHours }) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[new Date().getDay()] as keyof LocationHours;

  return (
    <div className="space-y-1 text-sm">
      {Object.entries(hours).map(([day, dayHours]) => {
        if (day === 'notes') return null;

        const isToday = day === today;
        const dayName = getDayName(day as keyof LocationHours);

        return (
          <div
            key={day}
            className={cn(
              'flex justify-between',
              isToday && 'font-semibold text-primary'
            )}
          >
            <span>{dayName}</span>
            <span>
              {dayHours.closed
                ? 'Closed'
                : `${format24to12Hour(dayHours.open)} - ${format24to12Hour(dayHours.close)}`
              }
            </span>
          </div>
        );
      })}
      {hours.notes && (
        <p className="mt-2 text-xs text-muted-foreground italic">
          {hours.notes}
        </p>
      )}
    </div>
  );
}

/**
 * Location info component
 */
function LocationInfo({ location }: { location: LocationInfo }) {
  return (
    <div className="space-y-4">
      {/* Address */}
      <div className="flex items-start space-x-3">
        <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="font-semibold">{location.name}</p>
          <p className="text-sm text-muted-foreground">
            {location.address}
            <br />
            {location.city}, {location.state} {location.zipCode}
          </p>
          {location.mapUrl && (
            <Button
              variant="link"
              size="sm"
              asChild
              className="h-auto p-0 text-xs"
            >
              <Link
                href={location.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1"
              >
                <span>View on Maps</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-2">
        {location.phone && (
          <div className="flex items-center space-x-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <Link
              href={`tel:${location.phone}`}
              className="text-sm hover:underline"
            >
              {location.phone}
            </Link>
          </div>
        )}
        {location.email && (
          <div className="flex items-center space-x-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <Link
              href={`mailto:${location.email}`}
              className="text-sm hover:underline"
            >
              {location.email}
            </Link>
          </div>
        )}
      </div>

      {/* Hours */}
      <div className="flex items-start space-x-3">
        <Clock className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold mb-2">Hours</p>
          <HoursDisplay hours={location.hours} />
        </div>
      </div>
    </div>
  );
}

/**
 * Main footer component with location selector and information
 */
export function Footer() {
  const { currentLocation, setLocation } = useLocationContext();

  return (
    <footer className="border-t bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Location Selector and Info - MOVED TO FIRST */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <h3 className="font-semibold mb-3">Visit Us</h3>
              <div className="inline-flex items-center p-1 bg-secondary rounded-lg">
                <button
                  onClick={() => setLocation(Location.LAWRENCEVILLE)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all",
                    currentLocation === Location.LAWRENCEVILLE
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Lawrenceville
                </button>
                <button
                  onClick={() => setLocation(Location.ZELIENOPLE)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all",
                    currentLocation === Location.ZELIENOPLE
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Zelienople
                </button>
              </div>
            </div>

            <LocationInfo location={LOCATIONS_DATA[currentLocation]} />
          </div>

          {/* Quick Links - MOVED TO SECOND */}
          <div>
            <h3 className="font-semibold mb-3">Explore</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/beer-map" className="text-muted-foreground hover:text-foreground transition-colors">
                  Beer Map
                </Link>
              </li>
              <li>
                <Link href="/events" className="text-muted-foreground hover:text-foreground transition-colors">
                  Events
                </Link>
              </li>
              <li>
                <Link href="/food" className="text-muted-foreground hover:text-foreground transition-colors">
                  Food Trucks
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Brand and Description - MOVED TO LAST */}
          <div className="lg:col-span-2 flex flex-col items-end text-right">
            <Logo className="mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Craft brewery with locations in Lawrenceville and Zelienople,
              Pennsylvania. Serving exceptional beer and building community.
            </p>
            <SocialLinks size="sm" />
          </div>
        </div>

        {/* Bottom footer */}
        <div className="mt-8 pt-8 border-t flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Lolev Beer. All rights reserved.
          </p>
          <div className="flex space-x-4 text-sm">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}