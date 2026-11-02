'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1))
const MINUTES = ['00', '15', '30', '45']

/** Explicit 12-hour controls; the form and server still exchange HH:MM in 24-hour time. */
export function TimePicker({
  id,
  value,
  onChange,
  disabled,
  'aria-label': label = 'Time',
  'aria-invalid': invalid,
  'aria-describedby': describedBy,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}) {
  // Minutes and period can be chosen before the hour without inventing a start time.
  const [draftMinute, setDraftMinute] = useState('00')
  const [draftPeriod, setDraftPeriod] = useState('PM')
  const [hours24, minutes] = value.split(':')
  const hour = value ? String(Number(hours24) % 12 || 12) : ''
  const minute = value ? minutes : draftMinute
  const period = value ? (Number(hours24) >= 12 ? 'PM' : 'AM') : draftPeriod

  function change(nextHour: string, nextMinute: string, nextPeriod: string) {
    setDraftMinute(nextMinute)
    setDraftPeriod(nextPeriod)
    if (!nextHour) return
    const hours = (Number(nextHour) % 12) + (nextPeriod === 'PM' ? 12 : 0)
    onChange(`${String(hours).padStart(2, '0')}:${nextMinute}`)
  }

  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-2">
      <Select
        value={hour}
        onValueChange={(next) => change(next, minute, period)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-label={`${label} hour`}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="w-full"
        >
          <SelectValue placeholder="Hour" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {HOURS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        value={minute}
        onValueChange={(next) => change(hour, next, period)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={`${label} minute`}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {MINUTES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        value={period}
        onValueChange={(next) => change(hour, minute, next)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={`${label} AM or PM`}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
