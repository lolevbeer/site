/**
 * /private-events inquiry: always open, event details before contact details,
 * one-tap taproom (preselected from the header) and occasion buttons, optional
 * phone, fields checked on blur, a summary on success, field errors show under
 * each field, focus moves to the confirmation, the date min is client-only, and
 * an accepted inquiry sends the `event_inquiry_submitted` conversion.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const submitEventInquiry = vi.fn()
vi.mock('@/src/actions/event-inquiry', () => ({
  submitEventInquiry: (input: unknown) => submitEventInquiry(input),
}))
const track = vi.fn()
let headerLocation = 'lawrenceville'
vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: headerLocation }),
}))
vi.mock('@vercel/analytics', () => ({ track: (...args: unknown[]) => track(...args) }))

// The Radix switch measures itself; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

import { EventInquiryForm } from '@/components/events/event-inquiry-form'

const gtag = vi.fn()
beforeEach(() => {
  headerLocation = 'lawrenceville'
  submitEventInquiry.mockReset()
  track.mockReset()
  gtag.mockReset()
  window.gtag = gtag
})
afterEach(() => {
  cleanup()
  delete window.gtag
})

const taprooms = [
  { id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville' },
  { id: 'loc-2', slug: 'zelienople', name: 'Zelienople' },
]

describe('EventInquiryForm', () => {
  it('is open on load and asks about the event before contact details', () => {
    const { container } = render(<EventInquiryForm taprooms={taprooms} />)
    expect(container.querySelector('details')).toBeNull()
    const labels = Array.from(container.querySelectorAll('label')).map((l) => l.textContent)
    expect(labels).toEqual([
      'Preferred date',
      'How many guests?',
      'My date is flexible',
      'Taproom',
      'Occasion (optional)',
      'Your name',
      'Email',
      'Phone (optional)',
      'Anything else? (optional)',
    ])
  })

  it('pairs date with guests but stacks email and phone (single column)', () => {
    render(<EventInquiryForm taprooms={taprooms} />)
    const row = (id: string) => document.getElementById(id)?.closest('[data-slot=field-row]')
    expect(row('inquiry-preferredDate')).toBeTruthy()
    expect(row('inquiry-preferredDate')).toBe(row('inquiry-headcount'))
    expect(row('inquiry-email')).toBeNull()
    expect(row('inquiry-phone')).toBeNull()
  })

  it('preselects the taproom chosen in the header, and the visitor can change it', () => {
    headerLocation = 'zelienople'
    render(<EventInquiryForm taprooms={taprooms} />)
    const zelienople = screen.getByRole('button', { name: 'Zelienople' })
    expect(zelienople.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Lawrenceville' }))
    expect(zelienople.getAttribute('aria-pressed')).toBe('false')
  })

  it('flags a bad email on blur but leaves an untouched empty field alone', () => {
    render(<EventInquiryForm taprooms={taprooms} />)
    const email = screen.getByLabelText('Email')
    fireEvent.blur(email)
    expect(email.getAttribute('aria-invalid')).toBeNull()
    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.blur(email)
    expect(email.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById('inquiry-email-error')?.textContent).toBe('Enter a valid email.')
  })

  it('toggles an occasion on and off and sends it with the flexible flag', async () => {
    submitEventInquiry.mockResolvedValueOnce({ ok: false, error: 'x' })
    render(<EventInquiryForm taprooms={taprooms} />)
    const birthday = screen.getByRole('button', { name: 'Birthday' })
    fireEvent.click(birthday)
    expect(birthday.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('switch', { name: 'My date is flexible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(submitEventInquiry).toHaveBeenCalled())
    expect(submitEventInquiry.mock.calls[0][0]).toMatchObject({
      occasion: 'birthday',
      flexibleDate: true,
      taproom: 'lawrenceville',
    })
    fireEvent.click(birthday)
    expect(birthday.getAttribute('aria-pressed')).toBe('false')
  })

  it('lets a flexible visitor tap several other days and tracks them as chips', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T16:00:00Z')) // Wed Oct 14, noon EDT
    submitEventInquiry.mockResolvedValue({ ok: false, error: 'x' })
    render(<EventInquiryForm taprooms={taprooms} />)
    expect(screen.queryByRole('group', { name: 'Other dates that also work' })).toBeNull()

    fireEvent.click(screen.getByRole('switch', { name: 'My date is flexible' }))
    const calendar = screen.getByRole('group', { name: 'Other dates that also work' })
    fireEvent.click(within(calendar).getByRole('button', { name: /October 30/ }))
    fireEvent.click(within(calendar).getByRole('button', { name: /October 24/ }))

    const chips = screen.getByRole('list', { name: 'Other dates picked' })
    expect(within(chips).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Sat, Oct 24',
      'Fri, Oct 30',
    ])
    expect(screen.getByText('2 other dates picked')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Remove Saturday, October 24/ }))
    expect(screen.getByText('1 other date picked')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(submitEventInquiry).toHaveBeenCalledTimes(1))
    expect(submitEventInquiry.mock.calls[0][0]).toMatchObject({
      flexibleDate: true,
      otherDates: ['2026-10-30'],
    })

    // Switching back off sends no extra days.
    fireEvent.click(screen.getByRole('switch', { name: 'My date is flexible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(submitEventInquiry).toHaveBeenCalledTimes(2))
    expect(submitEventInquiry.mock.calls[1][0]).toMatchObject({ flexibleDate: false, otherDates: [] })
    vi.useRealTimers()
    // Several full calendar re-renders: ~70ms alone, but over 5s under full-suite load.
  }, 15_000)

  it('does not offer the preferred date again as another date', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T16:00:00Z'))
    render(<EventInquiryForm taprooms={taprooms} />)
    fireEvent.click(screen.getByLabelText('Preferred date'))
    fireEvent.click(screen.getByRole('button', { name: /October 24/ }))
    fireEvent.click(screen.getByRole('switch', { name: 'My date is flexible' }))
    const calendar = screen.getByRole('group', { name: 'Other dates that also work' })
    expect(within(calendar).getByRole('button', { name: /October 24/ }).hasAttribute('disabled')).toBe(
      true,
    )
    vi.useRealTimers()
  })

  it('repeats what was sent on the confirmation', async () => {
    submitEventInquiry.mockResolvedValueOnce({ ok: true })
    render(<EventInquiryForm taprooms={taprooms} />)
    fireEvent.change(screen.getByLabelText('How many guests?'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.org' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(screen.getByText('Inquiry received')).toBeTruthy())
    const status = screen.getByRole('status').textContent
    expect(status).toContain('30 guests')
    expect(status).toContain('Lawrenceville')
    expect(status).toContain('ada@example.org')
  })

  it('picks a taproom in one tap', () => {
    render(<EventInquiryForm taprooms={taprooms} />)
    const zelienople = screen.getByRole('button', { name: 'Zelienople' })
    expect(zelienople.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(zelienople)
    expect(zelienople.getAttribute('aria-pressed')).toBe('true')
  })

  it('preselects the only taproom', () => {
    headerLocation = 'zelienople'
    render(<EventInquiryForm taprooms={taprooms.slice(0, 1)} />)
    expect(screen.getByRole('button', { name: 'Lawrenceville' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
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
