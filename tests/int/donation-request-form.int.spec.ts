/**
 * Donation ringer: Continue on page 1 stays disabled until every gate switch is on.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const submitDonationRequest = vi.fn()
vi.mock('@/src/actions/donation-request', () => ({
  submitDonationRequest: (input: unknown) => submitDonationRequest(input),
}))
const track = vi.fn()
vi.mock('@vercel/analytics', () => ({ track: (...args: unknown[]) => track(...args) }))

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    locations: [
      { id: '1', slug: 'north-side', name: 'North Side', active: true },
      { id: '2', slug: 'south-side', name: 'South Side', active: true },
    ],
  }),
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

import { DonationRequestForm } from '@/components/donate/donation-request-form'

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

describe('DonationRequestForm', () => {
  it('blocks Continue until every eligibility switch is on', () => {
    render(createElement(DonationRequestForm))

    expect(
      screen.getByText(/reasonable drive from our North Side and South Side taprooms/),
    ).toBeTruthy()

    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(continueButton).toHaveProperty('disabled', true)

    for (const toggle of screen.getAllByRole('switch')) {
      fireEvent.click(toggle)
    }

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', false)
  })

  it('blocks Organization Continue until required fields are filled', () => {
    render(createElement(DonationRequestForm))
    for (const toggle of screen.getAllByRole('switch')) {
      fireEvent.click(toggle)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByLabelText('Organization name')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('alert').textContent).toMatch(/fields need fixing.*organization/i)
    expect(screen.queryByRole('tooltip')).toBeNull()
    // Every invalid field shows its own error as text, not just the first.
    const expected: Array<[string, string, string]> = [
      ['Organization name', 'organizationName', 'Enter the organization name.'],
      ['Your name', 'contactName', 'Enter a contact name.'],
      ['Email', 'email', 'Enter a valid email.'],
    ]
    for (const [label, id, message] of expected) {
      const input = screen.getByLabelText(label)
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(`${id}-error`)
      expect(document.getElementById(`${id}-error`)?.textContent).toBe(message)
    }
    // Select: the aria links sit on the trigger, not the Radix Root.
    const trigger = document.getElementById('previousDonation')
    expect(trigger?.getAttribute('aria-invalid')).toBe('true')
    expect(trigger?.getAttribute('aria-describedby')).toBe('previousDonation-error')
    expect(document.getElementById('previousDonation-error')?.textContent).toBe(
      'Say whether we have donated before.',
    )
  })
  it('sends donate_submitted once the request is accepted', async () => {
    submitDonationRequest.mockResolvedValue({ ok: true })
    const { container } = render(createElement(DonationRequestForm))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(screen.getByText('We got it')).toBeTruthy())
    expect(track).toHaveBeenCalledWith('donate_submitted', undefined)
    expect(gtag).toHaveBeenCalledWith('event', 'donate_submitted', undefined)
  })
  it('sends nothing when the request is rejected', async () => {
    submitDonationRequest.mockResolvedValue({ ok: false, error: 'Server said no.', step: 3 })
    const { container } = render(createElement(DonationRequestForm))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(screen.getByText('Server said no.')).toBeTruthy())
    expect(track).not.toHaveBeenCalled()
    expect(gtag).not.toHaveBeenCalled()
  })
})
