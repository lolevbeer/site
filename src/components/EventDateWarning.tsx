'use client'

import React, { useEffect, useState } from 'react'
import { useAllFormFields, useDocumentInfo } from '@payloadcms/ui'
import {
  getEventsOnDate,
  getFoodOnDateRange,
  getRecurringFoodData,
  getFoodVendor,
} from '@/src/actions/admin-data'

const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const weekKeys = ['first', 'second', 'third', 'fourth', 'fifth'] as const

function getWeekOccurrence(date: Date): number {
  const dayOfMonth = date.getDate()
  return Math.ceil(dayOfMonth / 7)
}

function getDayName(date: Date): string {
  return days[date.getDay()]
}

interface ConflictingEvent {
  organizer: string
  visibility: string
}

interface FoodVendor {
  name: string
  type: 'recurring' | 'individual'
}

export const EventDateWarning: React.FC = () => {
  const [eventConflicts, setEventConflicts] = useState<ConflictingEvent[]>([])
  const [foodVendors, setFoodVendors] = useState<FoodVendor[]>([])
  const [loading, setLoading] = useState(false)

  const [fields] = useAllFormFields()
  const { id: currentDocId } = useDocumentInfo()
  const dateValue = fields['date']?.value as string | undefined
  const locationRaw = fields['location']?.value as string | { id?: string } | undefined

  // Extract location ID whether it's a string or object
  const locationValue = typeof locationRaw === 'string' ? locationRaw : locationRaw?.id

  useEffect(() => {
    if (!dateValue || !locationValue) {
      setEventConflicts([])
      setFoodVendors([])
      return
    }

    const checkAll = async () => {
      setLoading(true)

      try {
        const date = new Date(dateValue)
        const dateOnly = dateValue.split('T')[0]

        // Check other events using local API
        const eventConflicting: ConflictingEvent[] = []
        try {
          const events = await getEventsOnDate(dateValue, locationValue)
          for (const doc of events) {
            if (currentDocId && doc.id === currentDocId) continue
            eventConflicting.push({
              organizer: doc.organizer,
              visibility: doc.visibility,
            })
          }
        } catch (error) {
          console.error('Error checking events:', error)
        }
        setEventConflicts(eventConflicting)

        // Check food vendors
        const vendors: FoodVendor[] = []

        // Check recurring food using local API
        try {
          const dayName = getDayName(date)
          const weekOccurrence = getWeekOccurrence(date)
          const weekKey = weekKeys[weekOccurrence - 1]

          const data = await getRecurringFoodData()

          // Data structure: data.schedules[locationId][dayName][weekKey]
          const vendorId = data.schedules?.[locationValue]?.[dayName]?.[weekKey]

          if (vendorId) {
            // Check if this date is excluded
            const exclusions = data.exclusions?.[locationValue] || []
            const isExcluded = exclusions.includes(dateOnly)

            if (!isExcluded) {
              // Fetch vendor name using local API
              const vendor = await getFoodVendor(vendorId)
              const vendorName = vendor?.name || 'Unknown vendor'
              vendors.push({ name: vendorName, type: 'recurring' })
            }
          }
        } catch (error) {
          console.error('Error checking recurring food:', error)
        }

        // Check individual food events using local API
        try {
          const foodDocs = await getFoodOnDateRange(dateValue, locationValue)
          for (const doc of foodDocs) {
            vendors.push({ name: doc.vendorName, type: 'individual' })
          }
        } catch (error) {
          console.error('Error checking individual food:', error)
        }

        setFoodVendors(vendors)
      } catch (error) {
        console.error('Error checking date conflicts:', error)
        setEventConflicts([])
        setFoodVendors([])
      } finally {
        setLoading(false)
      }
    }

    checkAll()
  }, [dateValue, locationValue, currentDocId])

  if (!dateValue || !locationValue || loading) {
    return null
  }

  if (eventConflicts.length === 0 && foodVendors.length === 0) {
    return null
  }

  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: 'var(--theme-success-100)',
        border: '1px solid var(--theme-success-500)',
        borderRadius: '4px',
        marginBottom: '16px',
      }}
    >
      <strong style={{ color: 'var(--theme-success-700)' }}>Note:</strong>{' '}
      <span style={{ color: 'var(--theme-success-800)' }}>
        {eventConflicts.length > 0 && (
          <>
            {eventConflicts.length === 1 ? 'Another event' : `${eventConflicts.length} other events`}{' '}
            scheduled:{' '}
            {eventConflicts.map((c, i) => (
              <span key={i}>
                {i > 0 && ', '}
                <strong>{c.organizer}</strong>
                {c.visibility === 'private' && ' (private)'}
              </span>
            ))}
          </>
        )}
        {eventConflicts.length > 0 && foodVendors.length > 0 && <br />}
        {foodVendors.length > 0 && (
          <>
            Food scheduled:{' '}
            {foodVendors.map((v, i) => (
              <span key={i}>
                {i > 0 && ', '}
                <strong>{v.name}</strong>
                {v.type === 'recurring' ? ' (recurring)' : ''}
              </span>
            ))}
          </>
        )}
      </span>
    </div>
  )
}
