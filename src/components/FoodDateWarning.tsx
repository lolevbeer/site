'use client'

import React, { useEffect, useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { getFoodOnDate } from '@/src/actions/admin-data'
import { logger } from '@/lib/utils/logger'
import {
  getAdminRelationshipID,
  type AdminRelationshipValue,
} from '@/src/components/admin/relationship-value'
import { getRecurringVendorName } from '@/src/components/admin/recurring-vendor'

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

    // No clearing needed: the render below already returns null whenever the
    // date or location is missing, so leaving the previous warnings in state is
    // invisible — and clearing here would be a setState in an effect body.
    if (!dateValue || !locationValue) return

    const checkVendors = async () => {
      setLoading(true)
      const newWarnings: Warning[] = []

      try {
        // Check recurring vendors
        try {
          const vendorName = await getRecurringVendorName(new Date(dateValue), locationValue)
          if (vendorName) newWarnings.push({ type: 'recurring', vendorName })
        } catch (error) {
          logger.error('Error checking recurring vendors:', error)
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
