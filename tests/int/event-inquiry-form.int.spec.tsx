/**
 * /events private-event inquiry: collapsed by default, field errors show under
 * each field, focus moves to the confirmation, the date min is client-only, and
 * an accepted inquiry sends the `event_inquiry_submitted` conversion.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const submitEventInquiry = vi.fn()
vi.mock('@/src/actions/event-inquiry', () => ({
  submitEventInquiry: (input: unknown) => submitEventInquiry(input),
}))
const track = vi.fn()
vi.mock('@vercel/analytics', () => ({ track: (...args: unknown[]) => track(...args) }))

import { EventInquiryForm } from '@/components/events/event-inquiry-form'

const gtag = vi.fn()
beforeEach(() => {
  track.mockReset()
  gtag.mockReset()
  window.gtag = gtag
})
afterEach(() => {
  cleanup()
  delete window.gtag
})

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
    // A rejected submit is not a conversion.
    expect(track).not.toHaveBeenCalled()
    expect(gtag).not.toHaveBeenCalled()

    submitEventInquiry.mockResolvedValueOnce({ ok: true })
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(screen.getByText('Inquiry received')).toBeTruthy())
    expect(document.activeElement?.textContent).toBe('Inquiry received')
    expect(track).toHaveBeenCalledWith('event_inquiry_submitted', undefined)
    expect(gtag).toHaveBeenCalledWith('event', 'event_inquiry_submitted', undefined)
  })

  it('marks the taproom select required for assistive tech', () => {
    render(<EventInquiryForm taprooms={taprooms} />)
    expect(document.getElementById('inquiry-taproom')?.getAttribute('aria-required')).toBe('true')
  })

  it('picks the preferred date from a calendar, past days disabled after mount', () => {
    // The page is ISR-cached, so "today" (the earliest day) is client-only.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T16:00:00Z')) // Wed Oct 14, noon EDT
    render(<EventInquiryForm taprooms={taprooms} />)
    const trigger = screen.getByLabelText('Preferred date')
    expect(trigger.tagName).toBe('BUTTON')
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: /October 13/ }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /October 24/ }))
    expect(screen.getByLabelText('Preferred date').textContent).toBe('Saturday, October 24, 2026')
    // Screen readers hear the chosen date, not just the label.
    expect(trigger.getAttribute('aria-describedby')).toBe('inquiry-preferredDate-value')
    vi.useRealTimers()
  })
})
