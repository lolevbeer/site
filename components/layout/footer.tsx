'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SocialLinks } from './social-links'
import { HandwrittenLolevLogo } from '@/components/icons'
import type { LocationSlug, PayloadLocation } from '@/lib/types/location'
import { useLocationContext } from '@/components/location/location-provider'
import { navigationItems } from './navigation'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'
import { ThemeSwitcher } from '@/components/ui/theme-switcher'
import { WeeklyHoursTable } from '@/components/location/weekly-hours'

/**
 * Location info component
 */
function LocationInfoSection({
  location,
  weeklyHours,
}: {
  location: PayloadLocation
  weeklyHours?: WeeklyHoursDay[]
}) {
  // Use custom directions URL if provided, otherwise construct from address
  const mapUrl =
    location.address?.directionsUrl ||
    (location.address?.street && location.address?.city && location.address?.state
      ? `https://maps.google.com/?q=${encodeURIComponent(`${location.address.street}, ${location.address.city}, ${location.address.state}`)}`
      : undefined)

  return (
    <div className="space-y-4">
      {/* Address */}
      <div>
        <p className="font-semibold">Lolev {location.name}</p>
        {mapUrl ? (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors block"
          >
            {location.address?.street}
            <br />
            {location.address?.city}, {location.address?.state} {location.address?.zip}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            {location.address?.street}
            <br />
            {location.address?.city}, {location.address?.state} {location.address?.zip}
          </p>
        )}
      </div>

      {/* Hours */}
      <div>
        <p className="font-semibold mb-2">Hours</p>
        {weeklyHours ? (
          <WeeklyHoursTable weeklyHours={weeklyHours} variant="footer" />
        ) : (
          <p className="text-sm text-muted-foreground">Hours not available</p>
        )}
      </div>

      {/* Contact */}
      <div className="space-y-2 text-sm">
        {location.basicInfo?.phone && (
          <Link href={`tel:${location.basicInfo.phone}`} className="block hover:underline">
            {location.basicInfo.phone}
          </Link>
        )}
        {location.basicInfo?.email && (
          <Link href={`mailto:${location.basicInfo.email}`} className="block hover:underline">
            {location.basicInfo.email}
          </Link>
        )}
      </div>
    </div>
  )
}

interface FooterProps {
  weeklyHours?: Record<string, WeeklyHoursDay[]>
}

/**
 * Main footer component with all active locations displayed
 */
export function Footer({ weeklyHours }: FooterProps) {
  const { locations } = useLocationContext()

  // Filter to only active locations
  const activeLocations = locations.filter((loc) => loc.active !== false)

  return (
    <footer className="bg-background">
      <div className="gradient-separator" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Dynamic Location Sections */}
          {activeLocations.map((location) => {
            const locationKey = (location.slug || location.id) as LocationSlug
            return (
              <div key={locationKey}>
                <LocationInfoSection location={location} weeklyHours={weeklyHours?.[locationKey]} />
              </div>
            )
          })}

          {/* Brand and Links */}
          <div className="flex flex-col items-center">
            <p className="text-sm text-muted-foreground mb-6">Haze • Crispy • Funky • Oaked</p>

            <ul className="space-y-2 text-sm mb-6 text-center">
              {navigationItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <HandwrittenLolevLogo className="py-12 w-48 text-muted-foreground" />

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
              <Link href="/faq">FAQ</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/privacy">Privacy Policy</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/accessibility">Accessibility</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/terms">Terms of Service</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">Login</Link>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}
