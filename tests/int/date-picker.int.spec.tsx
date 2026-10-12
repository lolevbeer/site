/**
 * DatePicker: a button that opens a calendar popover. Value in and out is a
 * YYYY-MM-DD string (the same contract as <input type="date">), days outside
 * `min`..`max` are disabled, `min` is the calendar's "today", and screen
 * readers hear the chosen date alongside FormField's label and messages.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatePicker } from '@/components/ui/date-picker'
import { FormField } from '@/components/ui/form-field'

afterEach(cleanup)

describe('DatePicker', () => {
  it('reports YYYY-MM-DD and disables days outside min..max', () => {
    const onChange = vi.fn()
    render(<DatePicker id="d" value="" onChange={onChange} min="2026-10-12" max="2026-10-25" />)
    fireEvent.click(screen.getByRole('button', { name: /pick a date/i }))

    expect(screen.getByRole('dialog', { name: 'Choose a date' })).toBeTruthy()
    const day = (n: number) =>
      screen.getByRole('button', { name: new RegExp(`October ${n}(st|nd|rd|th)?,`) })
    expect(day(11).hasAttribute('disabled')).toBe(true)
    expect(day(26).hasAttribute('disabled')).toBe(true)
    // `min` is the calendar's today (New York), not the browser's clock.
    expect(day(12).closest('td')?.hasAttribute('data-today')).toBe(true)
    fireEvent.click(day(20))
    expect(onChange).toHaveBeenCalledWith('2026-10-20')
  })

  it('announces the chosen date with the FormField label and error', () => {
    const { rerender } = render(
      <FormField id="d" label="Preferred date" error="Enter a preferred date.">
        <DatePicker id="d" value="" onChange={() => {}} />
      </FormField>,
    )
    const trigger = screen.getByLabelText('Preferred date')
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger.getAttribute('aria-invalid')).toBe('true')
    expect(trigger.getAttribute('aria-describedby')).toBe('d-value d-error')
    expect(document.getElementById('d-value')?.textContent).toBe('Pick a date')

    rerender(
      <FormField id="d" label="Preferred date">
        <DatePicker id="d" value="2026-10-20" onChange={() => {}} />
      </FormField>,
    )
    expect(document.getElementById('d-value')?.textContent).toBe('Tuesday, October 20, 2026')
  })
})
