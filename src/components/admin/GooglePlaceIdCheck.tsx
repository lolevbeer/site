'use client'

/**
 * Under a Location's "Google place ID" field: looks the typed ID up on Google
 * Business Profile and shows the profile's name and address in green when one
 * matches, so a wrong ID is caught before the nightly hours check uses it.
 * When the listing's address or phone differ from this Location's, a button
 * copies Google's into the form (saved only when the editor saves). Admins only.
 */

import { useState } from 'react'
import { Button, useAuth, useField } from '@payloadcms/ui'
import { isAdmin } from '@/src/access/roles'
import type { User } from '@/src/payload-types'
import type { GoogleListingDetails } from '@/src/actions/google-place-check'
import { describeFailure, useGooglePlace } from './google-place-lookup'

const NOTE = { margin: '4px 0 0' }

/** The Location fields Google's details fill, with their labels. */
const FILLS: Array<{ key: keyof GoogleListingDetails; path: string; label: string }> = [
  { key: 'street', path: 'address.street', label: 'Street' },
  { key: 'city', path: 'address.city', label: 'City' },
  { key: 'state', path: 'address.state', label: 'State' },
  { key: 'zip', path: 'address.zip', label: 'Postal code' },
  { key: 'phone', path: 'basicInfo.phone', label: 'Public phone' },
]

/** One form field Google can fill, and its current value. */
function useFill(path: string) {
  const { value, setValue } = useField<string>({ path })
  return { value: value?.trim() ?? '', setValue }
}

export function GooglePlaceIdCheck({ path }: { path: string }) {
  const { value } = useField<string>({ path })
  // Only admins may run the check, so nobody else gets a line here at all.
  const admin = isAdmin(useAuth<User>().user)
  const result = useGooglePlace(admin ? (value?.trim() ?? '') : '')
  const fields = [
    useFill('address.street'),
    useFill('address.city'),
    useFill('address.state'),
    useFill('address.zip'),
    useFill('basicInfo.phone'),
  ]
  const [copied, setCopied] = useState(false)

  if (!admin || !value?.trim()) return null
  if (!result) return <p style={NOTE}>Checking with Google…</p>
  if (!result.ok) {
    return (
      <p role="alert" style={{ ...NOTE, color: 'var(--color-text-danger)' }}>
        {describeFailure(result)}
      </p>
    )
  }

  const differences = FILLS.map((fill, index) => ({
    ...fill,
    field: fields[index],
    google: result.details[fill.key],
  })).filter(({ field, google }) => google && google !== field.value)

  function copy() {
    for (const { field, google } of differences) field.setValue(google)
    setCopied(true)
  }

  return (
    <div>
      <p role="status" style={{ ...NOTE, color: 'var(--color-text-success)' }}>
        ✓ Found on Google: {[result.title, result.address].filter(Boolean).join(', ')}
      </p>
      {copied && differences.length === 0 && (
        <p role="status" style={NOTE}>
          Copied Google&apos;s address and phone. Save to keep them.
        </p>
      )}
      {differences.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p style={NOTE}>Google&apos;s listing has a different address or phone:</p>
          <ul style={{ margin: '4px 0 8px', paddingLeft: 20 }}>
            {differences.map(({ path: fieldPath, label, field, google }) => (
              <li key={fieldPath}>
                {label}: {field.value || '(blank)'} → {google}
              </li>
            ))}
          </ul>
          <Button buttonStyle="secondary" onClick={copy}>
            Use Google&apos;s address and phone
          </Button>
        </div>
      )}
    </div>
  )
}
