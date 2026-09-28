'use client'

import { useEffect, useState } from 'react'
import { Banner, Button, useAuth, useDocumentInfo, useField } from '@payloadcms/ui'
import { isAdmin } from '@/src/access/roles'
import { logger } from '@/lib/utils/logger'
import {
  getAdminRelationshipID,
  type AdminRelationshipValue,
} from '@/src/components/admin/relationship-value'
import { daysSinceCleaned, LINES_OVERDUE_DAYS, LINES_WARN_DAYS } from '@/lib/utils/lines-cleaned'

export function MarkLinesCleanedButton() {
  const { user } = useAuth()
  const { id: docId, collectionSlug } = useDocumentInfo()
  const { value: locationFieldValue } = useField<AdminRelationshipValue>({ path: 'location' })
  const { value: locationFormValue, setValue: setLocationFormValue } = useField<string>({
    path: 'linesLastCleaned',
  })
  const locationId =
    collectionSlug === 'locations'
      ? getAdminRelationshipID(docId)
      : getAdminRelationshipID(locationFieldValue)
  const isLocationDoc = collectionSlug === 'locations'
  // Only the fetched branch needs state. On a location document the value
  // already lives in the form, and with no location there is nothing to show —
  // both are derived below rather than copied into state by an effect, which
  // is what react-hooks/set-state-in-effect flags.
  const [fetchedLastCleaned, setFetchedLastCleaned] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const lastCleaned = isLocationDoc ? locationFormValue || null : fetchedLastCleaned
  const loading = !isLocationDoc && Boolean(locationId) && fetching

  useEffect(() => {
    if (isLocationDoc || !locationId) return

    const controller = new AbortController()
    const currentLocationId = locationId

    async function loadLocation() {
      setFetching(true)
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
        setFetchedLastCleaned(location.linesLastCleaned || null)
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        logger.error('Failed to load the line-cleaning date:', caught)
        setError('Could not load the current line-cleaning date.')
      } finally {
        if (!controller.signal.aborted) setFetching(false)
      }
    }

    void loadLocation()
    return () => controller.abort()
  }, [isLocationDoc, locationId])

  async function handleClick() {
    if (!locationId || saving) return

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const response = await fetch(`/api/locations/${encodeURIComponent(locationId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markLinesCleanedToday: true }),
      })

      if (!response.ok) throw new Error(`Location update failed (${response.status})`)

      const result = (await response.json()) as {
        doc?: { linesLastCleaned?: string | null }
        linesLastCleaned?: string | null
      }
      const savedValue = result.doc?.linesLastCleaned || result.linesLastCleaned
      if (!savedValue) throw new Error('Location response is missing the saved cleaning date')

      setFetchedLastCleaned(savedValue)
      if (collectionSlug === 'locations') setLocationFormValue(savedValue)
      setSaved(true)
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
    // .field-type: Payload's field spacing (gap between the banners and the
    // button, and the standard space before the next sidebar field).
    <div className="field-type" style={{ width: '100%' }}>
      <p>
        {loading
          ? 'Loading last cleaning…'
          : lastCleaned && cleanedDays !== null
            ? `Last cleaned: ${new Date(lastCleaned).toLocaleDateString('en-US', {
                timeZone: 'America/New_York',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}`
            : 'No cleaning date recorded.'}
      </p>
      <p>Records today immediately for this location. No menu save is needed.</p>
      {error && (
        <div role="alert">
          <Banner type="danger">{error}</Banner>
        </div>
      )}
      {saved && (
        <p role="status">Saved. Lines cleaned today. Live menus will update automatically.</p>
      )}
      {isOverdue && <Banner type="danger">OVERDUE - Lines need cleaning!</Banner>}
      {isReadyToClean && <Banner type="default">Ready to be cleaned</Banner>}
      <div style={{ width: '100%' }}>
        <Button
          buttonStyle="secondary"
          disabled={!locationId || loading || saving}
          onClick={() => void handleClick()}
          size="medium"
          type="button"
        >
          {saving ? 'Saving…' : loading ? 'Loading…' : 'Mark Lines Cleaned Today'}
        </Button>
      </div>
      {isAdmin(user) && !isLocationDoc && locationId && (
        <a href={`/admin/collections/locations/${encodeURIComponent(locationId)}`}>
          Correct the cleaning date in location settings
        </a>
      )}
    </div>
  )
}
