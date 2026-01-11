'use client'

import { useField, useDocumentInfo, Button, Banner } from '@payloadcms/ui'

export function MarkLinesCleanedButton() {
  const { value, setValue } = useField<string>({ path: 'linesLastCleaned' })
  const { id: docId, collectionSlug } = useDocumentInfo()
  const { value: locationFieldValue } = useField<string>({ path: 'location' })

  const handleClick = () => {
    const today = new Date().toISOString()
    setValue(today)

    // Get location ID - either the doc ID (if editing location) or the location field (if editing menu)
    const locationId = collectionSlug === 'locations' ? docId : locationFieldValue

    // Dispatch event for optimistic update of global alert
    if (locationId) {
      window.dispatchEvent(new CustomEvent('linesCleanedUpdate', { detail: { locationId } }))
    }
  }

  // Calculate days since last cleaned
  let daysSinceCleaned: number | null = null
  if (value) {
    const lastCleaned = new Date(value)
    const now = new Date()
    const diffMs = now.getTime() - lastCleaned.getTime()
    daysSinceCleaned = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  const isOverdue = daysSinceCleaned !== null && daysSinceCleaned >= 15
  const isReadyToClean = daysSinceCleaned !== null && daysSinceCleaned >= 7 && daysSinceCleaned < 15

  return (
    <div style={{ marginTop: '-8px', width: '100%' }}>
      {isOverdue && (
        <Banner type="error">
          OVERDUE - Lines need cleaning!
        </Banner>
      )}
      {isReadyToClean && (
        <Banner type="info">
          Ready to be cleaned
        </Banner>
      )}
      <div style={{ width: '100%' }}>
        <Button
          buttonStyle="secondary"
          size="medium"
          onClick={handleClick}
        >
          Lines Cleaned Today
        </Button>
      </div>
    </div>
  )
}
