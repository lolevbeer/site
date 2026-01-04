'use client'

import React, { useEffect, useState } from 'react'
import { useAllFormFields, useDocumentInfo } from '@payloadcms/ui'

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

  const [fields] = useAllFormFields()
  const { id: currentDocId } = useDocumentInfo()
  const dateValue = fields['date']?.value as string | undefined
  const locationRaw = fields['location']?.value as string | { id?: string } | undefined

  // Extract location ID whether it's a string or object
  const locationValue = typeof locationRaw === 'string' ? locationRaw : locationRaw?.id

  useEffect(() => {
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

        // Check recurring vendors using location ID
        if (weekKey) {
          try {
            const response = await fetch('/api/globals/recurring-food?depth=1')
            const data = await response.json()

            // New data structure: data.schedules[locationId][dayName][weekKey]
            const vendorId = data.schedules?.[locationValue]?.[dayName]?.[weekKey]

            if (vendorId) {
              // Check if this date is excluded
              const exclusions = data.exclusions?.[locationValue] || []
              const isExcluded = exclusions.includes(dateKey)

              if (!isExcluded) {
                // Fetch vendor name
                try {
                  const vendorResponse = await fetch(`/api/food-vendors/${vendorId}`)
                  const vendorData = await vendorResponse.json()
                  const vendorName = vendorData.name || 'Unknown vendor'
                  newWarnings.push({ type: 'recurring', vendorName })
                } catch {
                  newWarnings.push({ type: 'recurring', vendorName: 'Unknown vendor' })
                }
              }
            }
          } catch (error) {
            console.error('Error checking recurring vendors:', error)
          }
        }

        // Check individual food events
        try {
          const foodResponse = await fetch(
            `/api/food?where[date][equals]=${dateValue}&where[location][equals]=${locationValue}&depth=1`,
          )
          const foodData = await foodResponse.json()

          if (foodData.docs && foodData.docs.length > 0) {
            for (const doc of foodData.docs) {
              // Skip if this is the current document being edited
              if (currentDocId && doc.id === currentDocId) continue

              const vendorName = doc.vendor?.name || doc.vendorName || 'Unknown vendor'
              newWarnings.push({ type: 'individual', vendorName })
            }
          }
        } catch (error) {
          console.error('Error checking individual food events:', error)
        }

        setWarnings(newWarnings)
      } catch (error) {
        console.error('Error checking vendors:', error)
        setWarnings([])
      } finally {
        setLoading(false)
      }
    }

    checkVendors()
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
