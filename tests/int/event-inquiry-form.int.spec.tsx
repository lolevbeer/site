/** /events private-event inquiry: collapsed by default, field errors show under each field. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const submitEventInquiry = vi.fn()
vi.mock('@/src/actions/event-inquiry', () => ({
  submitEventInquiry: (input: unknown) => submitEventInquiry(input),
}))

import { EventInquiryForm } from '@/components/events/event-inquiry-form'

afterEach(cleanup)

const taprooms = [{ id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville' }]

describe('EventInquiryForm', () => {
  it('sits behind a closed disclosure', () => {
    const { container } = render(<EventInquiryForm taprooms={taprooms} />)
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details?.open).toBe(false)
    expect(screen.getByText('Planning a private event?').tagName).toBe('SUMMARY')
  })

  it('marks invalid fields and thanks the visitor on success', async () => {
    submitEventInquiry.mockResolvedValueOnce({
      ok: false,
      error: '2 fields need fixing. Enter your name.',
      errors: { name: 'Enter your name.', headcount: 'Enter how many guests.' },
    })
    render(<EventInquiryForm taprooms={taprooms} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))

    const name = screen.getByLabelText('Your name')
    await waitFor(() => expect(name.getAttribute('aria-invalid')).toBe('true'))
    expect(document.getElementById('inquiry-name-error')?.textContent).toBe('Enter your name.')
    expect(document.getElementById('inquiry-headcount-error')?.textContent).toBe(
      'Enter how many guests.',
    )

    fireEvent.change(name, { target: { value: 'Ada' } })
    expect(name.getAttribute('aria-invalid')).toBeNull()

    submitEventInquiry.mockResolvedValueOnce({ ok: true })
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(screen.getByText('Inquiry received')).toBeTruthy())
  })
})
