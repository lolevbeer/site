'use client'

import { useEffect, useState } from 'react'
import { Banner, Button, useDocumentInfo, useField } from '@payloadcms/ui'
import { logger } from '@/lib/utils/logger'
import {
  getAdminRelationshipID,
  type AdminRelationshipValue,
} from '@/src/components/admin/relationship-value'
import {
  daysSinceCleaned,
  LINES_OVERDUE_DAYS,
  LINES_WARN_DAYS,
} from '@/src/components/admin/lines-cleaned'

export function MarkLinesCleanedButton() {
  const { id: docId, collectionSlug } = useDocumentInfo()
  const { value: locationFieldValue } = useField<AdminRelationshipValue>({ path: 'location' })
  const { value: locationFormValue, setValue: setLocationFormValue } = useField<string>({
    path: 'linesLastCleaned',
  })
  const locationId =
    collectionSlug === 'locations'
      ? getAdminRelationshipID(docId)
      : getAdminRelationshipID(locationFieldValue)
  const [lastCleaned, setLastCleaned] = useState<string | null>(
    collectionSlug === 'locations' ? locationFormValue || null : null,
  )
  const [loading, setLoading] = useState(collectionSlug !== 'locations')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (collectionSlug === 'locations') {
      setLastCleaned(locationFormValue || null)
      setLoading(false)
      return
    }

    if (!locationId) {
      setLastCleaned(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const currentLocationId = locationId

    async function loadLocation() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/locations/${encodeURIComponent(currentLocationId)}?depth=0`,
          {
            credentials: 'same-origin',
            signal: controller.signal,
          },
        )

        if (!response.ok) throw new Error(`Location request failed (${response.status})`)

        const location = (await response.json()) as { linesLastCleaned?: string | null }
        setLastCleaned(location.linesLastCleaned || null)
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        logger.error('Failed to load the line-cleaning date:', caught)
        setError('Could not load the current line-cleaning date.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadLocation()
    return () => controller.abort()
  }, [collectionSlug, locationFieldValue, locationFormValue, locationId])

  async function handleClick() {
    if (!locationId || saving) return

    setSaving(true)
    setError(null)
    const cleanedAt = new Date().toISOString()

    try {
      const response = await fetch(`/api/locations/${encodeURIComponent(locationId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linesLastCleaned: cleanedAt }),
      })

      if (!response.ok) throw new Error(`Location update failed (${response.status})`)

      const result = (await response.json()) as {
        doc?: { linesLastCleaned?: string | null }
        linesLastCleaned?: string | null
      }
      const savedValue = result.doc?.linesLastCleaned || result.linesLastCleaned || cleanedAt

      setLastCleaned(savedValue)
      if (collectionSlug === 'locations') setLocationFormValue(savedValue)
      window.dispatchEvent(
        new CustomEvent('linesCleanedUpdate', { detail: { locationId, cleanedAt: savedValue } }),
      )
    } catch (caught) {
      logger.error('Failed to update the line-cleaning date:', caught)
      setError('The line-cleaning date was not saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const cleanedDays = daysSinceCleaned(lastCleaned)
  const isOverdue = cleanedDays !== null && cleanedDays >= LINES_OVERDUE_DAYS
  const isReadyToClean =
    cleanedDays !== null && cleanedDays >= LINES_WARN_DAYS && cleanedDays < LINES_OVERDUE_DAYS

  return (
    <div style={{ marginTop: '-8px', width: '100%' }}>
      {error && <Banner type="error">{error}</Banner>}
      {isOverdue && <Banner type="error">OVERDUE - Lines need cleaning!</Banner>}
      {isReadyToClean && <Banner type="info">Ready to be cleaned</Banner>}
      <div style={{ width: '100%' }}>
        <Button
          buttonStyle="secondary"
          disabled={!locationId || loading || saving}
          onClick={() => void handleClick()}
          size="medium"
          type="button"
        >
          {saving ? 'Saving…' : loading ? 'Loading…' : 'Lines Cleaned Today'}
        </Button>
      </div>
    </div>
  )
}
