'use client'

import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { toLocationInfo } from '@/lib/types/location'
import { isLocationOpenNow } from '@/lib/config/locations'
import { cn } from '@/lib/utils'
import { useLocationContext } from './location-provider'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'
import { formatHoursRange, getTodayDayOfWeek } from './weekly-hours'

interface HoursPanelProps {
  weeklyHours?: Record<string, WeeklyHoursDay[]>
  className?: string
}

export function HoursPanel({ weeklyHours, className }: HoursPanelProps) {
  const { locations } = useLocationContext()
  const currentDay = getTodayDayOfWeek()

  return (
    <div className={cn('', className)}>
      <Accordion type="single" collapsible className="w-full">
        {locations.map((location) => {
          const slug = location.slug || location.id
          const locationInfo = toLocationInfo(location)
          const isOpen = isLocationOpenNow(location)
          const locationWeeklyHours = weeklyHours?.[slug]
          const todayData = locationWeeklyHours?.find((d) => d.day === currentDay)
          const todayHours = todayData ? formatHoursRange(todayData) : 'Hours not available'

          return (
            <AccordionItem
              key={slug}
              value={slug}
              className="border-0 border-b border-border/50 last:border-b-0"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="text-left">
                    <div className="font-semibold">{location.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {todayHours}
                      {isOpen && (
                        <span className="text-green-600 dark:text-green-400 ml-2">Open</span>
                      )}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 space-y-1">
                  {/* Weekly schedule */}
                  {locationWeeklyHours ? (
                    <>
                      {locationWeeklyHours.some((d) => d.holidayName) && (
                        <div className="text-xs text-orange-600 dark:text-orange-400 mb-2">
                          Special hours this week
                        </div>
                      )}
                      {locationWeeklyHours.map((dayData) => {
                        const isToday = dayData.day === currentDay
                        const isSpecial = !!dayData.holidayName

                        return (
                          <div
                            key={dayData.day}
                            className={cn(
                              'flex justify-between items-center text-sm',
                              isToday && 'font-medium',
                              isSpecial && 'text-orange-600 dark:text-orange-400',
                            )}
                          >
                            <span className="capitalize">
                              {dayData.day.slice(0, 3)}
                              {dayData.holidayName && ` (${dayData.holidayName})`}
                            </span>
                            <span className={cn(!isToday && !isSpecial && 'text-muted-foreground')}>
                              {formatHoursRange(dayData)}
                            </span>
                          </div>
                        )
                      })}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Hours not available</p>
                  )}

                  {/* Contact info */}
                  <div className="pt-3 mt-2 space-y-1 text-sm text-muted-foreground">
                    {locationInfo.phone && (
                      <a href={`tel:${locationInfo.phone}`} className="block hover:text-foreground">
                        {locationInfo.phone}
                      </a>
                    )}
                    <a
                      href={locationInfo.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:text-foreground"
                    >
                      {locationInfo.address}, {locationInfo.city}
                    </a>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
