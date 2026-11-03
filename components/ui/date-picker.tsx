/**
 * shadcn date picker: a button that opens a Calendar popover. Takes and
 * reports a YYYY-MM-DD string, like <input type="date">, so form state and
 * server validation stay unchanged. The chosen day shows as "Sat, Oct 24, 2026"
 * so it fits a half-width phone column. Days outside `min`..`max` are disabled and
 * `min` is the calendar's "today" (pass the New York date, not the browser's).
 *
 * Inside FormField the <label> names the button, so the shown date is linked
 * through aria-describedby (`{id}-value`) for screen readers; FormField adds
 * its hint and error ids after it. Other props go on the button.
 */

'use client'

import { useState, type ComponentProps } from 'react'
import { Calendar as CalendarIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toDateKey } from '@/lib/utils/food-dates'
import { parseLocalDate } from '@/lib/utils/formatters'

function formatPickedDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
import { cn } from '@/lib/utils'

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  className,
  ...buttonProps
}: Omit<ComponentProps<typeof Button>, 'value' | 'onChange'> & {
  id: string
  value: string
  onChange: (value: string) => void
  /** Earliest selectable day, YYYY-MM-DD; also the calendar's "today". */
  min?: string
  /** Latest selectable day, YYYY-MM-DD. */
  max?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseLocalDate(value) : undefined
  const minDate = min ? parseLocalDate(min) : undefined
  const maxDate = max ? parseLocalDate(max) : undefined
  const valueId = `${id}-value`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            // Match Input: border-input, h-9, text-base (text-sm from md up), gray focus ring.
            'h-9 w-full justify-start border-input text-base font-normal md:text-sm focus-visible:ring-[3px] focus-visible:ring-offset-0 focus-visible:border-muted-foreground/60 focus-visible:ring-muted-foreground/20',
            !value && 'text-muted-foreground',
            className,
          )}
          {...buttonProps}
          aria-describedby={[valueId, buttonProps['aria-describedby']].filter(Boolean).join(' ')}
        >
          <CalendarIcon className="size-4" aria-hidden />
          <span id={valueId}>{value ? formatPickedDate(value) : 'Pick a date'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" aria-label="Choose a date">
        <Calendar
          mode="single"
          selected={selected}
          today={minDate}
          defaultMonth={selected ?? minDate}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          onSelect={(day) => {
            if (!day) return
            onChange(toDateKey(day))
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
