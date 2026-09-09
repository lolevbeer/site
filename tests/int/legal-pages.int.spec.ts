/**
 * Privacy, terms, and accessibility copy must match what the site actually does.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatLegalDate, LEGAL_PAGES_LASTMOD, LEGAL_PAGES_LASTMOD_LABEL } from '@/lib/legal/dates'

vi.mock('@/components/ui/page-breadcrumbs', () => ({
  PageBreadcrumbs: () => null,
}))
vi.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => null,
}))

import AccessibilityPage from '@/src/app/(frontend)/accessibility/page'
import PrivacyPage from '@/src/app/(frontend)/privacy/page'
import TermsPage from '@/src/app/(frontend)/terms/page'

afterEach(cleanup)

describe('legal dates', () => {
  it('derives the display label from the ISO lastmod', () => {
    expect(LEGAL_PAGES_LASTMOD_LABEL).toBe(formatLegalDate(LEGAL_PAGES_LASTMOD))
  })
})

describe('legal pages', () => {
  it('privacy names analytics, map geolocation, and the public forms', () => {
    render(createElement(PrivacyPage))

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeTruthy()
    const text = document.body.textContent || ''
    expect(text).toMatch(/Google Analytics/)
    expect(text).toMatch(/Vercel Analytics/)
    expect(text).toMatch(/Near Me/)
    expect(text).toMatch(/Mapbox Geocoding/)
    expect(text).toMatch(/Sentry/)
    expect(text).toMatch(/Square/)
    expect(text).toMatch(/Donation requests/)
    expect(text).toMatch(/Job applications/)
    expect(text).toMatch(/There is no mailing-list form on this site/)
    expect(text).not.toMatch(/There is no email-list signup on this site/)
    expect(text).not.toMatch(/send updates \(with consent\)/i)
  })

  it('terms say a donation or job form is not a yes', () => {
    render(createElement(TermsPage))

    expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeTruthy()
    expect(screen.getByText(/21 or older/)).toBeTruthy()
    expect(
      screen.getByText(/not a yes, an offer, or a contract/),
    ).toBeTruthy()
    expect(screen.getByText(/Hours, beer lists, food, events, and job openings change/)).toBeTruthy()
  })

  it('accessibility aims at WCAG 2.2 AA and does not claim a full audit', () => {
    render(createElement(AccessibilityPage))

    expect(screen.getByRole('heading', { name: 'Accessibility Statement' })).toBeTruthy()
    expect(screen.getByText(/WCAG 2.2 Level AA/)).toBeTruthy()
    expect(screen.getByText(/Mapbox/)).toBeTruthy()
    expect(screen.queryByText(/All 87 applicable success criteria/)).toBeNull()
    expect(screen.queryByText(/conforms to/i)).toBeNull()
    const wcag = screen.getByRole('link', { name: 'WCAG 2.2 Level AA' })
    expect(wcag.getAttribute('target')).toBe('_blank')
    expect(wcag.getAttribute('rel')).toMatch(/noopener/)
  })
})
