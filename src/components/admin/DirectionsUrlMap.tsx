'use client'

/**
 * Under a Location's "Directions URL" field: a small Google map of the place
 * the typed link points at, so a link to the wrong spot is caught before
 * saving. Only links that carry coordinates (the long google.com/maps/place/…
 * form) can be previewed; a short share link gets a note instead.
 */

import { useField } from '@payloadcms/ui'
import { coordsFromDirectionsUrl } from '@/lib/map/geo'
import { safeHttpUrl } from '@/lib/utils/url-utils'

const NOTE = { margin: '4px 0 0' }

export function DirectionsUrlMap({ path }: { path: string }) {
  const { value } = useField<string>({ path })
  const url = value?.trim() ?? ''
  if (!url) return null

  if (!safeHttpUrl(url)) {
    return (
      <p role="alert" style={{ ...NOTE, color: 'var(--theme-error-500)' }}>
        This is not a web link. It should start with https://
      </p>
    )
  }

  const pin = coordsFromDirectionsUrl(url)
  if (!pin) {
    return (
      <p role="status" style={NOTE}>
        No map preview: this link does not include a location. Open the place on Google Maps and
        copy the address from the browser bar to get one that does.
      </p>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <iframe
        title="Map of the place this link points at"
        src={`https://www.google.com/maps?q=${pin.lat},${pin.lng}&z=16&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ width: '100%', maxWidth: 480, height: 220, border: 0, borderRadius: 4 }}
      />
      <p role="status" style={NOTE}>
        Pin at {pin.lat}, {pin.lng}
      </p>
    </div>
  )
}
