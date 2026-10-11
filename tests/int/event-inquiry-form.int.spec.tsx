/**
 * /events private-event inquiry: collapsed by default, field errors show under
 * each field, focus moves to the confirmation, and the date min is client-only.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
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
    expect(document.activeElement?.textContent).toBe('Inquiry received')
  })

  it('marks the taproom select required for assistive tech', () => {
    render(<EventInquiryForm taprooms={taprooms} />)
    expect(document.getElementById('inquiry-taproom')?.getAttribute('aria-required')).toBe('true')
  })

  it('leaves the date min out of the server HTML and sets it after mount', () => {
    // The page is ISR-cached, so a server-rendered "today" can be stale on hydrate.
    expect(renderToString(<EventInquiryForm taprooms={taprooms} />)).not.toContain('min="20')
    render(<EventInquiryForm taprooms={taprooms} />)
    expect(screen.getByLabelText('Preferred date').getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
