/**
 * Labeled control with ring gutter and a shadcn tooltip for hints/errors.
 * Native browser validation bubbles are not used — wrap forms in noValidate.
 */

'use client'

import {
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function FormField({
  id,
  label,
  hint,
  error,
  forceOpen,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  forceOpen?: boolean
  children: ReactNode
}) {
  const [focused, setFocused] = useState(false)
  const invalid = Boolean(error)
  const message = error || hint
  const open = forceOpen || (hint && focused) ? true : undefined
  const control =
    invalid && isValidElement(children)
      ? cloneElement(children as ReactElement<{ 'aria-invalid'?: boolean }>, {
          'aria-invalid': true,
        })
      : children

  return (
    <Field
      data-invalid={invalid || undefined}
      className="overflow-visible"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="w-full min-w-0 overflow-visible p-1 -m-1">
        {message ? (
          <Tooltip open={open}>
            <TooltipTrigger asChild>
              <span className="block w-full min-w-0 [&>*]:w-full">{control}</span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="end"
              sideOffset={8}
              collisionPadding={16}
              className={cn(invalid && 'bg-destructive text-destructive-foreground')}
            >
              {message}
            </TooltipContent>
          </Tooltip>
        ) : (
          control
        )}
      </div>
    </Field>
  )
}
