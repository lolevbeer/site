/// <reference lib="es2024.promise" />
/**
 * /private-events inquiry: always open, event details before contact details,
 * one-tap taproom (preselected from the header) and occasion buttons, quote
 * fields (one start-time list; length, drinks starting on "Not sure", and an
 * optional food plan as one-tap buttons; optional company name), a digits-only guest count, optional phone,
 * fields checked on blur, a summary with the 24-hour reply promise on
 * success, field errors show under each field, focus moves to the confirmation, the date min is client-only, and
 * an accepted inquiry sends the `event_inquiry_submitted` conversion.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const originalMatchMedia = window.matchMedia
let desktopViewport = false
const viewportListeners = new Set<(event: MediaQueryListEvent) => void>()

beforeEach(() => {
  headerLocation = 'lawrenceville'
  desktopViewport = false
  viewportListeners.clear()
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      return query === '(min-width: 1024px)' && desktopViewport
    },
    media: query,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (query === '(min-width: 1024px)') viewportListeners.add(listener)
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      viewportListeners.delete(listener)
    },
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = vi.fn()
  submitEventInquiry.mockReset()
  track.mockReset()
  gtag.mockReset()
  window.gtag = gtag
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.matchMedia = originalMatchMedia
  delete window.gtag
})

const taprooms = [
  { id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville' },
  { id: 'loc-2', slug: 'zelienople', name: 'Zelienople' },
]

function resizeCalendar(desktop: boolean) {
  act(() => {
    desktopViewport = desktop
    const event = { matches: desktop, media: '(min-width: 1024px)' } as MediaQueryListEvent
    viewportListeners.forEach((listener) => listener(event))
  })
}

function chooseTime(value: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Start time (Eastern)' }), {
    key: 'Enter',
  })
  fireEvent.click(screen.getByRole('option', { name: value }))
}

describe('EventInquiryForm', () => {
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

  it('asks for an optional company name instead of a yes/no question', async () => {
    submitEventInquiry.mockResolvedValue({ ok: false, error: 'x' })
    render(<EventInquiryForm taprooms={taprooms} />)
    expect(screen.queryByRole('radio', { name: 'Yes' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Company name (if a company is paying)'), {
      target: { value: 'Acme Corp' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(submitEventInquiry).toHaveBeenCalled())
    expect(submitEventInquiry.mock.calls[0][0]).toMatchObject({ companyName: 'Acme Corp' })
    expect(submitEventInquiry.mock.calls[0][0]).not.toHaveProperty('companyPaid')
  })

  it('picks length and drinks in one tap, with drinks starting on "Not sure"', async () => {
    submitEventInquiry.mockResolvedValue({ ok: false, error: 'x' })
    render(<EventInquiryForm taprooms={taprooms} />)
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByRole('button', { name: 'Not sure' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: '3 hours' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Host tab' }))
    fireEvent.click(screen.getByRole('button', { name: '5+ hours' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(submitEventInquiry).toHaveBeenCalled())
    expect(submitEventInquiry.mock.calls[0][0]).toMatchObject({
      drinks: 'host-tab',
      duration: '5h+',
    })
  })

  it('keeps only digits in the guest count, so scrolling cannot change it', () => {
    render(<EventInquiryForm taprooms={taprooms} />)
    const guests = screen.getByLabelText('Guests') as HTMLInputElement
    expect(guests.type).toBe('text')
    expect(guests.inputMode).toBe('numeric')
    fireEvent.change(guests, { target: { value: '3a0' } })
    expect(guests.value).toBe('30')
  })

  it('shows a choice error under its buttons', async () => {
    submitEventInquiry.mockResolvedValueOnce({
      ok: false,
      error: 'x',
      errors: { drinks: 'Choose how drinks are handled.' },
    })
    render(<EventInquiryForm taprooms={taprooms} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() =>
      expect(document.getElementById('inquiry-drinks-error')?.textContent).toBe(
        'Choose how drinks are handled.',
      ),
    )
    expect(
      screen
        .getByRole('group', { name: 'How will drinks be handled?' })
        .getAttribute('aria-describedby'),
    ).toBe('inquiry-drinks-error')
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
    expect(
      within(chips)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Sat, Oct 24', 'Fri, Oct 30'])
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
    expect(submitEventInquiry.mock.calls[1][0]).toMatchObject({
      flexibleDate: false,
      otherDates: [],
    })
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
    expect(
      within(calendar)
        .getByRole('button', { name: /October 24/ })
        .hasAttribute('disabled'),
    ).toBe(true)
    vi.useRealTimers()
  })

  it('removes a newly preferred day from alternatives and the submitted summary count', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T16:00:00Z'))
    submitEventInquiry.mockResolvedValueOnce({ ok: true })
    render(<EventInquiryForm taprooms={taprooms} />)
    fireEvent.click(screen.getByRole('switch', { name: 'My date is flexible' }))
    const calendar = screen.getByRole('group', { name: 'Other dates that also work' })
    fireEvent.click(within(calendar).getByRole('button', { name: /October 24/ }))
    fireEvent.click(within(calendar).getByRole('button', { name: /October 30/ }))

    fireEvent.click(screen.getByLabelText('Preferred date'))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Choose a date' })).getByRole('button', {
        name: /October 24/,
      }),
    )

    expect(screen.queryByRole('button', { name: /Remove Saturday, October 24/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Remove Friday, October 30/ })).toBeTruthy()
    expect(screen.getByText('1 other date picked')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(screen.getByText('Inquiry received')).toBeTruthy())
    expect(submitEventInquiry.mock.calls[0][0]).toMatchObject({
      preferredDate: '2026-10-24',
      otherDates: ['2026-10-30'],
    })
    expect(screen.getByRole('status').textContent).toContain(
      'Saturday, October 24, 2026 + 1 other date',
    )
  })

  it('retains picked days while resizing the alternative calendar and navigating months', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T16:00:00Z'))
    submitEventInquiry.mockResolvedValueOnce({ ok: false, error: 'x' })
    render(<EventInquiryForm taprooms={taprooms} />)
    fireEvent.click(screen.getByRole('switch', { name: 'My date is flexible' }))
    const calendar = screen.getByRole('group', { name: 'Other dates that also work' })
    fireEvent.click(within(calendar).getByRole('button', { name: /October 24/ }))
    expect(within(calendar).queryByRole('button', { name: /December 12/ })).toBeNull()

    resizeCalendar(true)
    fireEvent.click(within(calendar).getByRole('button', { name: /December 12/ }))
    resizeCalendar(false)
    expect(within(calendar).queryByRole('button', { name: /^Saturday, December 12th/ })).toBeNull()
    fireEvent.click(within(calendar).getByRole('button', { name: /next month/i }))
    fireEvent.click(within(calendar).getByRole('button', { name: /November 21/ }))
    expect(
      within(screen.getByRole('list', { name: 'Other dates picked' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Sat, Oct 24', 'Sat, Nov 21', 'Sat, Dec 12'])

    fireEvent.click(screen.getByRole('button', { name: /Remove Saturday, October 24/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(submitEventInquiry).toHaveBeenCalledTimes(1))
    expect(submitEventInquiry.mock.calls[0][0]).toMatchObject({
      otherDates: ['2026-11-21', '2026-12-12'],
    })
  }, 15_000)

  it('lets a visitor tap a food plan and tap it again to clear it', async () => {
    submitEventInquiry.mockResolvedValue({ ok: false, error: 'x' })
    render(<EventInquiryForm taprooms={taprooms} />)
    expect(screen.getByRole('group', { name: 'Food plan (optional)' })).toBeTruthy()
    const truck = screen.getByRole('button', { name: 'Food truck' })
    fireEvent.click(truck)
    expect(truck.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(submitEventInquiry).toHaveBeenCalledTimes(1))
    expect(submitEventInquiry.mock.calls[0][0]).toMatchObject({ foodPlan: 'food-truck' })

    fireEvent.click(truck)
    expect(truck.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(submitEventInquiry).toHaveBeenCalledTimes(2))
    expect(submitEventInquiry.mock.calls[1][0]).toMatchObject({ foodPlan: '' })
  })

  it('freezes native and choice controls while pending, then restores input and error focus', async () => {
    const submission = Promise.withResolvers<{
      ok: false
      error: string
      errors: { headcount: string }
    }>()
    submitEventInquiry.mockReturnValueOnce(submission.promise)
    render(<EventInquiryForm taprooms={taprooms} />)
    const guests = screen.getByLabelText('Guests') as HTMLInputElement
    const email = screen.getByLabelText('Email') as HTMLInputElement
    const flexible = screen.getByRole('switch', { name: 'My date is flexible' })
    const birthday = screen.getByRole('button', { name: 'Birthday' })
    const zelienople = screen.getByRole('button', { name: 'Zelienople' })
    const company = screen.getByLabelText(
      'Company name (if a company is paying)',
    ) as HTMLInputElement
    fireEvent.change(guests, { target: { value: '30' } })
    fireEvent.change(email, { target: { value: 'ada@example.org' } })
    fireEvent.click(birthday)
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))

    for (const control of [
      guests,
      email,
      flexible,
      birthday,
      zelienople,
      company,
      screen.getByLabelText('Preferred date'),
      ...screen.getAllByRole('combobox'),
    ]) {
      expect(control.matches(':disabled')).toBe(true)
    }
    fireEvent.change(guests, { target: { value: '99' } })
    fireEvent.change(email, { target: { value: 'changed@example.org' } })
    fireEvent.click(flexible)
    fireEvent.keyDown(flexible, { key: ' ' })
    fireEvent.click(birthday)
    fireEvent.click(zelienople)
    fireEvent.change(company, { target: { value: 'Acme Corp' } })
    expect(guests.value).toBe('30')
    expect(email.value).toBe('ada@example.org')
    expect(flexible.getAttribute('aria-checked')).toBe('false')
    expect(birthday.getAttribute('aria-pressed')).toBe('true')
    expect(zelienople.getAttribute('aria-pressed')).toBe('false')
    expect(company.value).toBe('')

    await act(async () => {
      submission.resolve({
        ok: false,
        error: 'Check the guest estimate.',
        errors: { headcount: 'Check the guest estimate.' },
      })
    })
    expect(guests.matches(':disabled')).toBe(false)
    expect(document.activeElement).toBe(guests)
    expect(guests.value).toBe('30')
    expect(email.value).toBe('ada@example.org')
    fireEvent.change(guests, { target: { value: '45' } })
    fireEvent.click(flexible)
    fireEvent.click(zelienople)
    fireEvent.change(company, { target: { value: 'Acme Corp' } })
    submitEventInquiry.mockResolvedValueOnce({ ok: false, error: 'x' })
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(submitEventInquiry).toHaveBeenCalledTimes(2))
    expect(submitEventInquiry.mock.calls[1][0]).toMatchObject({
      headcount: 45,
      email: 'ada@example.org',
      flexibleDate: true,
      occasion: 'birthday',
      taproom: 'zelienople',
      companyName: 'Acme Corp',
    })
  })

  it('confirms submitted values even when the header taproom changes during and after sending', async () => {
    const submission = Promise.withResolvers<{ ok: true }>()
    submitEventInquiry.mockReturnValueOnce(submission.promise)
    const { rerender } = render(<EventInquiryForm taprooms={taprooms} />)
    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.org' } })
    chooseTime('6:30pm')
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    expect(submitEventInquiry.mock.calls[0][0]).toMatchObject({
      headcount: 30,
      email: 'ada@example.org',
      taproom: 'lawrenceville',
      startTime: '18:30',
    })
    headerLocation = 'zelienople'
    rerender(<EventInquiryForm taprooms={taprooms} />)
    await act(async () => submission.resolve({ ok: true }))
    expect(screen.getByText('Inquiry received')).toBeTruthy()
    const status = screen.getByRole('status').textContent
    expect(status).toContain('30 guests')
    expect(status).toContain('6:30pm Eastern')
    expect(status).toContain('Lawrenceville')
    expect(status).not.toContain('Zelienople')
    expect(status).toContain('ada@example.org within 24 hours')
    headerLocation = 'lawrenceville'
    rerender(<EventInquiryForm taprooms={taprooms} />)
    headerLocation = 'zelienople'
    rerender(<EventInquiryForm taprooms={taprooms} />)
    expect(screen.getByRole('status').textContent).toBe(status)
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
    expect(document.activeElement?.id).toBe('inquiry-headcount')

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
    expect(screen.getByLabelText('Preferred date').textContent).toBe('Sat, Oct 24, 2026')
    // Screen readers hear the chosen date, not just the label.
    expect(trigger.getAttribute('aria-describedby')).toBe('inquiry-preferredDate-value')
    vi.useRealTimers()
  })
})
