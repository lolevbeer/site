import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TimePicker } from '@/components/ui/time-picker'

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

function TimeField({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue)
  return (
    <>
      <TimePicker id="time" aria-label="Start time" value={value} onChange={setValue} />
      <output aria-label="Stored time">{value}</output>
    </>
  )
}

function choose(part: string, value: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: `Start time ${part}` }), { key: 'Enter' })
  fireEvent.click(screen.getByRole('option', { name: value }))
}

describe('TimePicker', () => {
  it('distinguishes noon from midnight without losing minutes', () => {
    render(<TimeField initialValue="12:30" />)
    choose('AM or PM', 'AM')
    expect(screen.getByLabelText('Stored time').textContent).toBe('00:30')
    choose('AM or PM', 'PM')
    expect(screen.getByLabelText('Stored time').textContent).toBe('12:30')
    choose('hour', '6')
    expect(screen.getByLabelText('Stored time').textContent).toBe('18:30')
  })

  it('does not invent an hour when minutes and AM/PM are chosen first', () => {
    render(<TimeField />)
    choose('minute', '45')
    choose('AM or PM', 'AM')
    expect(screen.getByLabelText('Stored time').textContent).toBe('')
    choose('hour', '12')
    expect(screen.getByLabelText('Stored time').textContent).toBe('00:45')
  })
})
