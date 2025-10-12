'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SocialLinks } from './social-links';
import { Logo } from '@/components/ui/logo';
import { Location, type LocationInfo, type LocationHours } from '@/lib/types';
import { LOCATIONS_DATA } from '@/lib/config/locations';
import { MapPin, Clock, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format24to12Hour } from '@/lib/utils/formatters';
import { navigationItems } from './navigation';

/**
 * Get day name from hours key
 */
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

function getDayName(day: DayOfWeek): string {
  const dayNames: Record<DayOfWeek, string> = {
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
  const today = dayNames[new Date().getDay()] as DayOfWeek;

  return (
    <div className="space-y-1 text-sm">
      {Object.entries(hours).map(([day, dayHours]) => {
        if (day === 'notes') return null;

        const isToday = day === today;
        const dayName = getDayName(day as DayOfWeek);

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
      {/* Hours */}
      <div className="flex items-start space-x-3">
        <Clock className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold mb-2">Hours</p>
          <HoursDisplay hours={location.hours} />
        </div>
      </div>

      {/* Address */}
      <div className="flex items-start space-x-3">
        <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="font-semibold">Lolev {location.name}</p>
          <p className="text-sm text-muted-foreground">
            {location.address}
            <br />
            {location.city}, {location.state} {location.zipCode}
          </p>
          {location.mapUrl && (
            <Link
              href={location.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 inline-block underline-offset-4 hover:underline"
            >
              View on Maps
            </Link>
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
    </div>
  );
}

/**
 * Main footer component with both locations displayed
 */
export function Footer() {
  return (
    <footer className="bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Lawrenceville Location */}
          <div>
            <h3 className="font-semibold mb-4 text-center md:text-left">Lawrenceville</h3>
            <LocationInfo location={LOCATIONS_DATA[Location.LAWRENCEVILLE]} />
          </div>

          {/* Zelienople Location */}
          <div>
            <h3 className="font-semibold mb-4 text-center md:text-left">Zelienople</h3>
            <LocationInfo location={LOCATIONS_DATA[Location.ZELIENOPLE]} />
          </div>

          {/* Brand and Links */}
          <div className="flex flex-col">
            <p className="text-sm text-muted-foreground mb-6">
              Craft brewery serving purposeful beer and building community in the Pittsburgh area.
            </p>

            <ul className="space-y-2 text-sm mb-6">
              {navigationItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-muted-foreground hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Logo className="py-12 text-muted-foreground" />

            <SocialLinks size="sm" className="mt-auto w-full" />
          </div>
        </div>

        {/* Bottom footer */}
        <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Lolev Beer. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button asChild variant="ghost" size="sm">
              <Link href="/faq">
                FAQ
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/privacy">
                Privacy Policy
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/accessibility">
                Accessibility
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/terms">
                Terms of Service
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}