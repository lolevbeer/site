'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { useLocationContext } from '@/components/location/location-provider'
import { WeeklyHoursTable } from '@/components/location/weekly-hours'
import { trackDirections } from '@/lib/analytics/events'
import { getLocationImageUrl } from '@/lib/utils/media-utils'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'

interface LocationCardsProps {
  weeklyHours?: Record<string, WeeklyHoursDay[]>
}

export function LocationCards({ weeklyHours }: LocationCardsProps) {
  const { locations } = useLocationContext()
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const handleImageError = (locationKey: string) => {
    setImageErrors((prev) => new Set(prev).add(locationKey))
  }

  // Fallback gradients by index when no image available
  const fallbackGradients = [
    'from-amber-200 to-orange-300',
    'from-green-200 to-blue-300',
    'from-blue-200 to-purple-300',
    'from-rose-200 to-pink-300',
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
      {locations.map((location, index) => {
        const locationKey = location.slug || location.id
        // Get image from CMS (images.card field)
        const cardImage = getLocationImageUrl(location.images?.card)
        const fallbackGradient = fallbackGradients[index % fallbackGradients.length]

        // Use custom directions URL if provided, otherwise generate from coordinates/address
        // coordinates is a point field: [longitude, latitude]
        const mapUrl =
          location.address?.directionsUrl ||
          (location.coordinates && location.coordinates.length === 2
            ? `https://www.google.com/maps/dir/?api=1&destination=${location.coordinates[1]},${location.coordinates[0]}`
            : location.address?.street && location.address?.city && location.address?.state
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zip || ''}`,
                )}`
              : '#')

        return (
          <div
            key={locationKey}
            className="flex flex-col relative pb-16 animate-stagger-in opacity-0"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Location Image */}
            <div className="aspect-video relative mb-6 group overflow-hidden rounded-lg">
              {cardImage && !imageErrors.has(locationKey) ? (
                <Image
                  src={cardImage}
                  alt={`${location.name} location`}
                  fill
                  className="object-cover transition-transform duration-[250ms] group-hover:scale-105"
                  priority={index === 0}
                  fetchPriority={index === 0 ? 'high' : 'low'}
                  quality={75}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  onError={() => handleImageError(locationKey)}
                />
              ) : (
                <div
                  className={`h-full bg-gradient-to-br ${fallbackGradient}`}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Location Info */}
            <div className="flex flex-col items-center text-center space-y-4">
              <h3 className="text-2xl font-bold">{location.name}</h3>

              {/* Address */}
              {location.address && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground text-lg hover:text-foreground hover:underline transition-colors"
                  onClick={() => trackDirections(location.name)}
                >
                  <p>{location.address.street}</p>
                  <p>
                    {location.address.city}
                    {location.address.state && `, ${location.address.state}`}
                    {location.address.zip && ` ${location.address.zip}`}
                  </p>
                </a>
              )}

              {/* Hours */}
              <div className="w-full max-w-xs">
                <p className="font-semibold mb-2">Hours</p>
                {weeklyHours && weeklyHours[locationKey] ? (
                  <WeeklyHoursTable weeklyHours={weeklyHours[locationKey]} variant="card" />
                ) : (
                  <p className="text-sm text-muted-foreground">Hours not available</p>
                )}
              </div>

              {/* Phone */}
              {location.basicInfo?.phone && (
                <div className="text-muted-foreground">
                  <a href={`tel:${location.basicInfo.phone}`} className="hover:underline">
                    {location.basicInfo.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Map Link Button - Positioned absolutely at bottom */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center">
              <Button asChild variant="default" size="default" className="w-full max-w-xs">
                <Link
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackDirections(location.name)}
                >
                  Get Directions
                </Link>
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
