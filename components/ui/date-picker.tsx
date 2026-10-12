/**
 * shadcn date picker: an outline button that opens a Calendar popover.
 * Takes and reports a YYYY-MM-DD string, like <input type="date">, so form
 * state and server validation stay unchanged. Days before `min` are disabled.
 * Extra props (FormField's aria-invalid / aria-describedby) go on the button.
 */

'use client'

import { useState, type ComponentProps } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate, parseLocalDate } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

export function DatePicker({
  value,
  onChange,
  min,
  defaultMonth,
  placeholder = 'Pick a date',
  className,
  ...buttonProps
}: Omit<ComponentProps<typeof Button>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  /** Earliest selectable day, YYYY-MM-DD. */
  min?: string
  /** Month shown when nothing is picked yet, YYYY-MM-DD (default: `min`, else today). */
  defaultMonth?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseLocalDate(value) : undefined
  const minDate = min ? parseLocalDate(min) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
          {...buttonProps}
        >
          <CalendarIcon className="size-4" aria-hidden />
          {value ? formatDate(value, 'full') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? (defaultMonth ? parseLocalDate(defaultMonth) : minDate)}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(day) => {
            if (!day) return
            onChange(format(day, 'yyyy-MM-dd'))
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
