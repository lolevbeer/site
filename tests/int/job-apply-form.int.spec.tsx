/** Job apply form shows each invalid field's error under that field. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const submitJobApplication = vi.fn()
vi.mock('@/src/actions/job-application', () => ({
  submitJobApplication: (input: unknown) => submitJobApplication(input),
}))

import { JobApplyForm } from '@/components/jobs/job-apply-form'

afterEach(cleanup)

describe('JobApplyForm', () => {
  it('marks every invalid field and clears an error when that field changes', async () => {
    submitJobApplication.mockResolvedValue({
      ok: false,
      error: 'Enter your name.',
      errors: { name: 'Enter your name.', email: 'Enter a valid email.' },
    })
    render(<JobApplyForm jobSlug="bartender" />)
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }))

    const name = screen.getByLabelText('Your name')
    await waitFor(() => expect(name.getAttribute('aria-invalid')).toBe('true'))
    expect(name.getAttribute('aria-describedby')).toBe('name-error')
    expect(document.getElementById('name-error')?.textContent).toBe('Enter your name.')
    const email = screen.getByLabelText('Email')
    expect(email.getAttribute('aria-describedby')).toBe('email-error')
    expect(document.getElementById('email-error')?.textContent).toBe('Enter a valid email.')
    expect(screen.getByLabelText('Phone').getAttribute('aria-invalid')).toBeNull()

    fireEvent.change(name, { target: { value: 'Ada' } })
    expect(name.getAttribute('aria-invalid')).toBeNull()
    expect(email.getAttribute('aria-invalid')).toBe('true')
  })
})
