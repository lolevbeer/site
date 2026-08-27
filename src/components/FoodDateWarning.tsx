'use client'

import React, { useEffect, useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { getRecurringFoodData, getFoodVendor, getFoodOnDate } from '@/src/actions/admin-data'
import { logger } from '@/lib/utils/logger'
import {
  getAdminRelationshipID,
  type AdminRelationshipValue,
} from '@/src/components/admin/relationship-value'

const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const weekKeys = ['first', 'second', 'third', 'fourth', 'fifth'] as const

function getWeekOccurrence(date: Date): number {
  const dayOfMonth = date.getDate()
  return Math.ceil(dayOfMonth / 7)
}

function getDayName(date: Date): string {
  return days[date.getDay()]
}

interface Warning {
  type: 'recurring' | 'individual'
  vendorName: string
}

export const FoodDateWarning: React.FC = () => {
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(false)

  const { id: currentDocId } = useDocumentInfo()
  const dateValue = useFormFields(([fields]) => fields.date?.value as string | undefined)
  const locationRaw = useFormFields(([fields]) => fields.location?.value as AdminRelationshipValue)
  const locationValue = getAdminRelationshipID(locationRaw)

  useEffect(() => {
    let cancelled = false

    if (!dateValue || !locationValue) {
      setWarnings([])
      return
    }

    const checkVendors = async () => {
      setLoading(true)
      const newWarnings: Warning[] = []

      try {
        const date = new Date(dateValue)
        const dayName = getDayName(date)
        const weekOccurrence = getWeekOccurrence(date)
        const weekKey = weekKeys[weekOccurrence - 1]
        const dateKey = date.toISOString().split('T')[0]

        // Check recurring vendors using local API
        if (weekKey) {
          try {
            const data = await getRecurringFoodData()

            // Data structure: data.schedules[locationId][dayName][weekKey]
            const vendorId = data.schedules?.[locationValue]?.[dayName]?.[weekKey]

            if (vendorId) {
              // Check if this date is excluded
              const exclusions = data.exclusions?.[locationValue] || []
              const isExcluded = exclusions.includes(dateKey)

              if (!isExcluded) {
                // Fetch vendor name using local API
                const vendor = await getFoodVendor(vendorId)
                const vendorName = vendor?.name || 'Unknown vendor'
                newWarnings.push({ type: 'recurring', vendorName })
              }
            }
          } catch (error) {
            logger.error('Error checking recurring vendors:', error)
          }
        }

        // Check individual food events using local API
        try {
          const foodDocs = await getFoodOnDate(dateValue, locationValue)

          for (const doc of foodDocs) {
            // Skip if this is the current document being edited
            if (currentDocId && doc.id === currentDocId) continue

            newWarnings.push({ type: 'individual', vendorName: doc.vendorName })
          }
        } catch (error) {
          logger.error('Error checking individual food events:', error)
        }

        if (!cancelled) setWarnings(newWarnings)
      } catch (error) {
        logger.error('Error checking vendors:', error)
        if (!cancelled) setWarnings([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void checkVendors()
    return () => {
      cancelled = true
    }
  }, [dateValue, locationValue, currentDocId])

  if (!dateValue || !locationValue || loading || warnings.length === 0) {
    return null
  }

  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: 'var(--theme-warning-100)',
        border: '1px solid var(--theme-warning-500)',
        borderRadius: '4px',
        marginBottom: '16px',
      }}
    >
      <strong style={{ color: 'var(--theme-warning-700)' }}>Note:</strong>{' '}
      <span style={{ color: 'var(--theme-warning-800)' }}>
        {warnings.map((w, i) => (
          <span key={i}>
            {i > 0 && ', '}
            <strong>{w.vendorName}</strong>
            {w.type === 'recurring' ? ' (recurring)' : ' (scheduled)'}
          </span>
        ))}{' '}
        already on this date.
      </span>
    </div>
  )
}
