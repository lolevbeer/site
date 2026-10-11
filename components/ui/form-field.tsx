/**
 * Labeled control with ring gutter and visible hint/error text under it.
 * The error (`{id}-error`) and hint (`{id}-description`) are linked to the
 * control through aria-describedby, so every invalid field shows its own
 * message and touch and screen-reader users get the hint too.
 * Native browser validation bubbles are not used — wrap forms in noValidate.
 */

'use client'

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'

type DescribedControlProps = { 'aria-invalid'?: boolean; 'aria-describedby'?: string }

/**
 * ARIA props linking a control to its FormField messages. FormField applies
 * them to its direct child; spread them yourself onto a control nested deeper,
 * such as a Select's SelectTrigger.
 */
export function formFieldAria(
  id: string,
  { hint, error }: { hint?: string; error?: string },
): DescribedControlProps {
  const describedBy = [error && `${id}-error`, hint && `${id}-description`].filter(Boolean)
  return {
    ...(error ? { 'aria-invalid': true } : {}),
    ...(describedBy.length ? { 'aria-describedby': describedBy.join(' ') } : {}),
  }
}

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  const aria = formFieldAria(id, { hint, error })
  const control =
    isValidElement(children) && Object.keys(aria).length
      ? cloneElement(children as ReactElement<DescribedControlProps>, aria)
      : children

  return (
    <Field data-invalid={Boolean(error) || undefined} className="overflow-visible">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="w-full min-w-0 overflow-visible p-1 -m-1">{control}</div>
      {/* No role="alert": the form's FormAlert announces the failure once,
        rather than every invalid field interrupting at the same moment. */}
      {error ? (
        <FieldError id={`${id}-error`} role={undefined}>
          {error}
        </FieldError>
      ) : null}
      {hint ? <FieldDescription id={`${id}-description`}>{hint}</FieldDescription> : null}
    </Field>
  )
}
