/**
 * shadcn date picker: a button that opens a Calendar popover. Takes and
 * reports a YYYY-MM-DD string, like <input type="date">, so form state and
 * server validation stay unchanged. Days outside `min`..`max` are disabled and
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
import { formatDate, parseLocalDate } from '@/lib/utils/formatters'
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
            // Match Input: border-input, text-base, h-10.
            'h-10 w-full justify-start border-input text-base font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
          {...buttonProps}
          aria-describedby={[valueId, buttonProps['aria-describedby']].filter(Boolean).join(' ')}
        >
          <CalendarIcon className="size-4" aria-hidden />
          <span id={valueId}>{value ? formatDate(value, 'full') : 'Pick a date'}</span>
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
