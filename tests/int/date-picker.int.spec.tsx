/**
 * DatePicker: a button that opens a calendar popover. Value in and out is a
 * YYYY-MM-DD string (the same contract as <input type="date">), days before
 * `min` are disabled, and FormField's ARIA lands on the trigger button.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatePicker } from '@/components/ui/date-picker'
import { FormField } from '@/components/ui/form-field'

afterEach(cleanup)

describe('DatePicker', () => {
  it('shows a placeholder, then the chosen date, and reports YYYY-MM-DD', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <DatePicker id="d" value="" onChange={onChange} min="2026-10-12" defaultMonth="2026-10-12" />,
    )
    const trigger = screen.getByRole('button', { name: /pick a date/i })
    fireEvent.click(trigger)

    // Before min: disabled. On/after min: selectable.
    expect(screen.getByRole('button', { name: /October 11/ }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /October 20/ }))
    expect(onChange).toHaveBeenCalledWith('2026-10-20')

    rerender(<DatePicker id="d" value="2026-10-20" onChange={onChange} min="2026-10-12" />)
    expect(screen.getByRole('button', { name: /Tuesday, October 20, 2026/ })).toBeTruthy()
  })

  it('takes FormField ARIA on the trigger', () => {
    render(
      <FormField id="d" label="Preferred date" error="Enter a preferred date.">
        <DatePicker id="d" value="" onChange={() => {}} />
      </FormField>,
    )
    const trigger = screen.getByLabelText('Preferred date')
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger.getAttribute('aria-invalid')).toBe('true')
    expect(trigger.getAttribute('aria-describedby')).toBe('d-error')
  })
})
