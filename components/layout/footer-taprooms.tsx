/**
 * Taproom name, street address, phone, and this week's hours as HTML.
 * A server component: the client footer only slots this in, so the text is
 * in the document without waiting on the location context or the map.
 */

import Link from 'next/link'
import { WeeklyHoursTable } from '@/components/location/weekly-hours'
import type { PayloadLocation } from '@/lib/types/location'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'

function mapsHref(location: PayloadLocation): string | undefined {
  const address = location.address
  if (!address) return undefined
  if (address.directionsUrl) return address.directionsUrl
  if (!address.street || !address.city || !address.state) return undefined
  const query = encodeURIComponent(`${address.street}, ${address.city}, ${address.state}`)
  return `https://maps.google.com/?q=${query}`
}

function StreetAddress({ location }: { location: PayloadLocation }) {
  const address = location.address
  return (
    <>
      {address?.street}
      <br />
      {address?.city}, {address?.state} {address?.zip}
    </>
  )
}

export function FooterTaprooms({
  locations,
  weeklyHours,
}: {
  locations: PayloadLocation[]
  weeklyHours?: Record<string, WeeklyHoursDay[]>
}) {
  return locations
    .filter((location) => location.active !== false)
    .map((location) => {
      const locationKey = location.slug || location.id
      const mapUrl = mapsHref(location)
      const hours = weeklyHours?.[locationKey]
      const phone = location.basicInfo?.phone?.trim()

      return (
        <div key={locationKey}>
          <div className="space-y-4 text-center">
            <address className="not-italic">
              <p className="font-semibold">
                {location.slug ? (
                  <Link href={`/${location.slug}`} className="hover:underline">
                    {location.name}
                  </Link>
                ) : (
                  location.name
                )}
              </p>
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors block"
                >
                  <StreetAddress location={location} />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <StreetAddress location={location} />
                </p>
              )}
            </address>

            <div>
              <p className="font-semibold mb-2">Hours</p>
              {hours ? (
                <WeeklyHoursTable weeklyHours={hours} variant="footer" />
              ) : (
                <p className="text-sm text-muted-foreground">Hours not available</p>
              )}
            </div>

            <div className="space-y-2 text-sm">
              {phone ? (
                <a href={`tel:${phone}`} className="block hover:underline">
                  {phone}
                </a>
              ) : null}
              {location.basicInfo?.email ? (
                <Link
                  href={`mailto:${location.basicInfo.email}`}
                  className="block hover:underline"
                >
                  {location.basicInfo.email}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      )
    })
}
