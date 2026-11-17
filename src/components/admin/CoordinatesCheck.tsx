'use client'

/**
 * Below a Location's "Map coordinates" field: compares them with the pin in
 * the Directions URL. The site's maps place the taproom by these coordinates,
 * so they should sit on that pin. Warns when they are more than a short walk
 * apart (or missing) and offers to copy the pin's position into the field.
 */

import { Button, useField } from '@payloadcms/ui'
import { pinOffset } from '@/lib/map/geo'

const NOTE = { margin: '4px 0 0' }

/** Farther apart than this, the map shows the taproom on the wrong spot. */
const TOLERANCE_METRES = 50

export function CoordinatesCheck() {
  const { value, setValue } = useField<[number, number] | null>({ path: 'coordinates' })
  const { value: directionsUrl } = useField<string>({ path: 'address.directionsUrl' })
  const offset = pinOffset(value, directionsUrl)
  if (!offset) return null

  const { pin, metres } = offset
  const usePin = (
    <Button buttonStyle="secondary" onClick={() => setValue([pin.lng, pin.lat])}>
      Use the Directions URL&apos;s pin
    </Button>
  )

  if (metres === null) {
    return (
      <div style={{ marginTop: 8 }}>
        <p style={NOTE}>No coordinates yet. The Directions URL has a pin to copy.</p>
        {usePin}
      </div>
    )
  }
  if (metres <= TOLERANCE_METRES) {
    return (
      <p role="status" style={{ ...NOTE, color: 'var(--theme-success-500)' }}>
        ✓ Matches the Directions URL&apos;s pin.
      </p>
    )
  }
  return (
    <div style={{ marginTop: 8 }}>
      <p role="alert" style={{ ...NOTE, color: 'var(--theme-error-500)' }}>
        These coordinates are {Math.round(metres)} m from the Directions URL&apos;s pin, so maps on
        the site put the taproom in the wrong place.
      </p>
      {usePin}
    </div>
  )
}
