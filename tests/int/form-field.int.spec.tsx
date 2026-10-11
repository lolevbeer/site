/** FormField shows hints and errors as visible text tied to the control. */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FormField } from '@/components/ui/form-field'

afterEach(cleanup)

function renderField(props: { hint?: string; error?: string }) {
  return render(
    <FormField id="mission" label="Mission" {...props}>
      <input id="mission" />
    </FormField>,
  )
}

describe('FormField', () => {
  it('shows the hint as visible text described by the control', () => {
    renderField({ hint: 'At least 40 characters.' })
    const input = screen.getByLabelText('Mission')
    expect(screen.getByText('At least 40 characters.')).toBeTruthy()
    expect(input.getAttribute('aria-describedby')).toBe('mission-description')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows the error and hint, both described by the invalid control', () => {
    renderField({ hint: 'At least 40 characters.', error: 'Too short.' })
    const input = screen.getByLabelText('Mission')
    expect(screen.getByText('Too short.')).toBeTruthy()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('mission-error mission-description')
  })

  it('leaves the control undescribed with neither hint nor error', () => {
    renderField({})
    expect(screen.getByLabelText('Mission').getAttribute('aria-describedby')).toBeNull()
  })
  it('keeps a description the control already had', () => {
    render(
      <FormField id="mission" label="Mission" error="Too short.">
        <input id="mission" aria-describedby="mission-count" />
      </FormField>,
    )
    expect(screen.getByLabelText('Mission').getAttribute('aria-describedby')).toBe(
      'mission-count mission-error',
    )
  })
})
