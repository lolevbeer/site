/**
 * Donation ringer: Continue on page 1 stays disabled until every gate switch is on.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/src/actions/donation-request', () => ({
  submitDonationRequest: vi.fn(),
}))

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

afterEach(cleanup)

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
    expect(screen.getByRole('alert').textContent).toMatch(/organization/i)
    expect(screen.queryByRole('tooltip')).toBeNull()
    // Every invalid field shows its own error as text, not just the first.
    for (const label of ['Organization name', 'Your name', 'Email']) {
      const input = screen.getByLabelText(label)
      expect(input.getAttribute('aria-invalid')).toBe('true')
      const errorId = input.getAttribute('aria-describedby')?.split(' ')[0] ?? ''
      expect(document.getElementById(errorId)?.textContent).toBeTruthy()
    }
  })
})
