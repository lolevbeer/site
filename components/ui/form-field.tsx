/**
 * Shared labeled fields for the public donate and job forms.
 */

import React from 'react'

export const fieldClass =
  'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

export const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 text-base'

export function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-left mb-1.5">
      {children}
    </label>
  )
}

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
    </div>
  )
}

export function FormAlert({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="text-sm text-destructive" role="alert">
      {error}
    </p>
  )
}
