/**
 * FAQ page closer: contact line plus taproom addresses.
 * Names the header-selected location and uses that taproom's phone.
 */

'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useLocationContext } from '@/components/location/location-provider'
import { formatCityStateZip } from '@/lib/config/locations'
import { cn } from '@/lib/utils'

export function FaqContactSection() {
  const { currentLocation, isClient, locations } = useLocationContext()
  const selected = isClient
    ? locations.find(
        (location) => location.slug === currentLocation || location.id === currentLocation,
      )
    : undefined
  const selectedPhone = selected?.basicInfo?.phone

  return (
    <section className="border-t border-border pt-12">
      <h2 className="text-2xl font-semibold text-center text-balance mb-3">
        Still have questions?
      </h2>
      <p className="text-center text-muted-foreground mb-10" aria-live="polite">
        Email{' '}
        <a href="mailto:info@lolev.beer" className="text-foreground hover:underline">
          info@lolev.beer
        </a>
        {selected && selectedPhone ? (
          <>
            {' '}or call {selected.name} at{' '}
            <a href={`tel:${selectedPhone}`} className="text-foreground hover:underline">
              {selectedPhone}
            </a>
            .
          </>
        ) : (
          '.'
        )}
      </p>

      {locations.length > 0 ? (
        <div className="mx-auto mb-10 grid max-w-2xl grid-cols-1 gap-8 sm:grid-cols-2">
          {locations.map((location) => {
            const cityLine = formatCityStateZip(location.address)
            const phone = location.basicInfo?.phone
            const isSelected =
              isClient &&
              (location.slug === currentLocation || location.id === currentLocation)

            return (
              <address
                key={location.id}
                aria-current={isSelected ? 'true' : undefined}
                className={cn('not-italic text-center text-sm', isSelected && 'text-foreground')}
              >
                {location.slug ? (
                  <Link
                    href={`/${location.slug}`}
                    className="font-semibold text-base hover:underline"
                  >
                    {location.name}
                  </Link>
                ) : (
                  <p className="font-semibold text-base">{location.name}</p>
                )}
                {isSelected ? (
                  <span className="sr-only"> (currently selected taproom)</span>
                ) : null}
                {location.address?.street ? (
                  <p className="mt-1 text-muted-foreground">{location.address.street}</p>
                ) : null}
                {cityLine ? <p className="text-muted-foreground">{cityLine}</p> : null}
                {phone ? (
                  <p className={cn('mt-1', isSelected ? 'font-medium' : 'text-muted-foreground')}>
                    <a href={`tel:${phone}`} className="hover:underline">
                      {phone}
                    </a>
                  </p>
                ) : null}
              </address>
            )
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 justify-center">
        <Button asChild variant="default">
          <Link href="/about">About Us</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/beer">Our Beers</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/events">Upcoming Events</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/beer-map">Find Our Beer</Link>
        </Button>
      </div>
    </section>
  )
}
