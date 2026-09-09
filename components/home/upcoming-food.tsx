'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { FoodSchedule, type FoodScheduleItem } from '@/components/food/food-schedule'
import { useLocationFilteredData, type LocationData } from '@/lib/hooks/use-location-filtered-data'
import { useSortedItems } from '@/lib/hooks/use-sorted-items'
import { useLocationContext } from '@/components/location/location-provider'
import { getMediaUrl } from '@/lib/utils/media-utils'
import { getLocationDisplayName } from '@/lib/config/locations'
import { safeHttpUrl } from '@/lib/utils/url-utils'
import type { LocationSlug } from '@/lib/types/location'

interface FoodVendor {
  vendor:
    | string
    | {
        id?: string
        name?: string
        site?: string | null
        logo?: unknown
      }
  date: string
  time?: string | null
  startTime?: string | null
  site?: string | null
  day?: string
  location?: LocationSlug | { slug?: string | null } | string
}

interface UpcomingFoodProps {
  /** Food organized by location slug */
  foodByLocation: Record<string, FoodVendor[]>
}

export function UpcomingFood({ foodByLocation }: UpcomingFoodProps): React.ReactElement | null {
  const { locations, currentLocation, currentLocationData } = useLocationContext()

  const dataByLocation = useMemo(() => {
    const result: LocationData<FoodVendor & { location: LocationSlug }> = {}
    for (const [locationSlug, foods] of Object.entries(foodByLocation)) {
      result[locationSlug] = foods.map((f) => ({ ...f, location: locationSlug }))
    }
    return result
  }, [foodByLocation])

  const filteredFood = useLocationFilteredData({ dataByLocation })
  const upcomingFood = useSortedItems(filteredFood, { limit: 6 })

  const rows: FoodScheduleItem[] = upcomingFood.map((food, index) => {
    const vendorName = typeof food.vendor === 'object' ? food.vendor?.name : food.vendor
    const vendorSite =
      food.site || (typeof food.vendor === 'object' ? food.vendor?.site : undefined)
    return {
      id: `${vendorName}-${food.date}-${index}`,
      date: food.date,
      vendor: vendorName || 'Vendor',
      time: food.time || food.startTime,
      site: safeHttpUrl(vendorSite),
      logoUrl: typeof food.vendor === 'object' ? getMediaUrl(food.vendor?.logo) : undefined,
      locationName:
        currentLocation === 'all'
          ? getLocationDisplayName(locations, food.location)
          : undefined,
    }
  })

  if (rows.length === 0) {
    return null
  }

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeader
            title="Food"
            locationName={currentLocationData?.name}
            adminUrl="/admin/collections/food"
          />
        </ScrollReveal>

        <div className="max-w-2xl mx-auto mb-8">
          <FoodSchedule items={rows} />
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/food">View All</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
