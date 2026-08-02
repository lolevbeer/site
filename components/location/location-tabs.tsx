/**
 * Location Tabs Component
 * Tab component for switching between brewery locations
 */

'use client'

import { type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useLocationContext } from './location-provider'

interface LocationTabsProps {
  className?: string
  children?: ReactNode
  syncWithGlobalState?: boolean
}

export function LocationTabs({
  className,
  children,
  syncWithGlobalState = false,
}: LocationTabsProps) {
  const { currentLocation, setLocation, isClient, locations } = useLocationContext()

  const handleValueChange = (newValue: string) => {
    if (syncWithGlobalState) {
      setLocation(newValue)
    }
  }

  // Prevent hydration mismatch by not rendering until client-side
  if (!isClient) {
    return (
      <div className={cn('w-full', className)}>
        <div className="grid w-fit mx-auto grid-cols-2 h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          {locations.map((location) => {
            const slug = location.slug || location.id
            return (
              <div
                key={slug}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
              >
                {location.name}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Tabs
      value={currentLocation}
      onValueChange={handleValueChange}
      className={cn('w-full', className)}
    >
      <TabsList className="grid w-fit mx-auto grid-cols-2">
        {locations.map((location) => {
          const slug = location.slug || location.id
          return (
            <TabsTrigger key={slug} value={slug} className="text-sm font-medium">
              {location.name}
            </TabsTrigger>
          )
        })}
      </TabsList>
      {children}
    </Tabs>
  )
}
