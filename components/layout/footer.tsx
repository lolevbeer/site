'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SocialLinks } from './social-links';
import { Logo } from '@/components/ui/logo';
import type { LocationSlug, PayloadLocation } from '@/lib/types/location';
import { useLocationContext } from '@/components/location/location-provider';
import { cn } from '@/lib/utils';
import { navigationItems } from './navigation';
import type { WeeklyHoursDay } from '@/lib/utils/payload-api';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';

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

function formatTime(time: string | null, timezone: string = 'America/New_York'): string {
  if (!time) return '';
  if (time.includes('T')) {
    const date = new Date(time);
    const minutes = date.getMinutes();
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: minutes === 0 ? undefined : '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  }
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  if (minutes === 0) {
    return `${displayHours} ${ampm}`;
  }
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Hours display component with holiday support
 */
function HoursDisplay({ weeklyHours }: { weeklyHours: WeeklyHoursDay[] }) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[new Date().getDay()] as DayOfWeek;
  const hasSpecialHours = weeklyHours.some(d => d.holidayName);

  return (
    <div className="space-y-1 text-sm">
      {hasSpecialHours && (
        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border">
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Special hours this week
          </span>
        </div>
      )}
      {weeklyHours.map((dayData) => {
        const isToday = dayData.day === today;
        const isSpecial = !!dayData.holidayName;

        return (
          <div
            key={dayData.day}
            className={cn(
              'flex justify-between items-center gap-2',
              isToday && 'font-semibold text-primary',
              isSpecial && !isToday && 'text-amber-600 dark:text-amber-400'
            )}
          >
            <span className="flex items-center gap-1">
              {getDayName(dayData.day)}
              {dayData.holidayName && (
                <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-500 text-amber-600 dark:text-amber-400">
                  {dayData.holidayName}
                </Badge>
              )}
            </span>
            <span>
              {dayData.closed
                ? 'Closed'
                : `${formatTime(dayData.open, dayData.timezone)} - ${formatTime(dayData.close, dayData.timezone)}`
              }
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Location info component
 */
function LocationInfoSection({ location, weeklyHours }: { location: PayloadLocation; weeklyHours?: WeeklyHoursDay[] }) {
  // Construct map URL from location data
  const mapUrl = location.address?.street && location.address?.city && location.address?.state
    ? `https://maps.google.com/?q=${encodeURIComponent(`${location.address.street}, ${location.address.city}, ${location.address.state}`)}`
    : undefined;

  return (
    <div className="space-y-4">
      {/* Address */}
      <div>
        <p className="font-semibold">Lolev {location.name}</p>
        <p className="text-sm text-muted-foreground">
          {location.address?.street}
          <br />
          {location.address?.city}, {location.address?.state} {location.address?.zip}
        </p>
        {mapUrl && (
          <Link
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 inline-block underline-offset-4 hover:underline"
          >
            View on Maps
          </Link>
        )}
      </div>

      {/* Hours */}
      <div>
        <p className="font-semibold mb-2">Hours</p>
        {weeklyHours ? (
          <HoursDisplay weeklyHours={weeklyHours} />
        ) : (
          <p className="text-sm text-muted-foreground">Hours not available</p>
        )}
      </div>

      {/* Contact */}
      <div className="space-y-2 text-sm">
        {location.basicInfo?.phone && (
          <Link
            href={`tel:${location.basicInfo.phone}`}
            className="block hover:underline"
          >
            {location.basicInfo.phone}
          </Link>
        )}
        {location.basicInfo?.email && (
          <Link
            href={`mailto:${location.basicInfo.email}`}
            className="block hover:underline"
          >
            {location.basicInfo.email}
          </Link>
        )}
      </div>
    </div>
  );
}

interface FooterProps {
  weeklyHours?: Record<string, WeeklyHoursDay[]>;
}

/**
 * Main footer component with all active locations displayed
 */
export function Footer({ weeklyHours }: FooterProps) {
  const { locations } = useLocationContext();

  // Filter to only active locations
  const activeLocations = locations.filter(loc => loc.active !== false);

  return (
    <footer className="bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Dynamic Location Sections */}
          {activeLocations.map((location) => {
            const locationKey = (location.slug || location.id) as LocationSlug;
            return (
              <div key={locationKey}>
                <LocationInfoSection
                  location={location}
                  weeklyHours={weeklyHours?.[locationKey]}
                />
              </div>
            );
          })}

          {/* Brand and Links */}
          <div className="flex flex-col items-center">
            <p className="text-sm text-muted-foreground mb-6">
              Haze • Crispy • Funky • Oaked
            </p>

            <ul className="space-y-2 text-sm mb-6 text-center">
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
        <div className="mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Lolev Beer. All rights reserved.
            </p>
            <ThemeSwitcher />
          </div>
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
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">
                Login
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}