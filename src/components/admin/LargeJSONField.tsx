'use client'

import { useField } from '@payloadcms/ui'
import type { JSONFieldClientProps } from 'payload'

export function LargeJSONField(props: JSONFieldClientProps) {
  const { value } = useField<unknown>({ path: props.path })

  // Format the JSON nicely
  const formattedValue = value ? JSON.stringify(value, null, 2) : ''

  // Get label as string
  const label = typeof props.field.label === 'string'
    ? props.field.label
    : props.field.name

  return (
    <div style={{ marginBottom: '24px' }}>
      <label className="field-label" style={{ marginBottom: '8px', display: 'block', fontWeight: 500 }}>
        {label}
      </label>
      <p style={{ fontSize: '12px', color: 'var(--theme-elevation-500)', marginBottom: '8px' }}>
        Positive reviews (4.5+ with text) from Untappd - auto-fetched
      </p>
      <pre
        style={{
          backgroundColor: 'var(--theme-elevation-50)',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: '4px',
          padding: '16px',
          overflow: 'auto',
          maxHeight: '500px',
          minHeight: '200px',
          fontSize: '13px',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {formattedValue || 'No reviews yet'}
      </pre>
    </div>
  )
}
