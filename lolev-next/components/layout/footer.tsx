'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SocialLinks } from './social-links';
import { Logo } from '@/components/ui/logo';
import { Location, LocationDisplayNames, type LocationInfo, type LocationHours } from '@/lib/types';
import { LOCATIONS_DATA } from '@/lib/config/locations';
import { MapPin, Clock, Phone, Mail, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Format time from 24-hour to 12-hour format
 */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

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
                : `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`
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
  const [selectedLocation, setSelectedLocation] = useState<Location>(Location.LAWRENCEVILLE);

  return (
    <footer className="border-t bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand and Description */}
          <div className="lg:col-span-1">
            <Logo className="mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Craft brewery with locations in Lawrenceville and Zelienople,
              Pennsylvania. Serving exceptional beer and building community.
            </p>
            <SocialLinks size="sm" />
          </div>

          {/* Quick Links */}
          <div>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/beer-map" className="text-muted-foreground hover:text-foreground">
                  Beer Map
                </Link>
              </li>
              <li>
                <Link href="/events" className="text-muted-foreground hover:text-foreground">
                  Events
                </Link>
              </li>
              <li>
                <Link href="/food" className="text-muted-foreground hover:text-foreground">
                  Food Trucks
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-foreground">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Location Selector and Info */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <h3 className="font-semibold mb-3">Visit Us</h3>
              <div className="inline-flex items-center p-1 bg-secondary rounded-lg">
                <button
                  onClick={() => setSelectedLocation(Location.LAWRENCEVILLE)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all",
                    selectedLocation === Location.LAWRENCEVILLE
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Lawrenceville
                </button>
                <button
                  onClick={() => setSelectedLocation(Location.ZELIENOPLE)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all",
                    selectedLocation === Location.ZELIENOPLE
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Zelienople
                </button>
              </div>
            </div>

            <LocationInfo location={LOCATIONS_DATA[selectedLocation]} />
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