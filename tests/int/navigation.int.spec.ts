/**
 * Donations and Jobs are footer-only — not in the header or mobile menu.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

import { footerOnlyItems, navigationItems } from '@/components/layout/navigation'

describe('navigationItems', () => {
  it('does not put Donations or Jobs in the header menu', () => {
    const labels = navigationItems.map((item) => item.label)
    expect(labels).not.toContain('Donations')
    expect(labels).not.toContain('Jobs')
  })
})

describe('footerOnlyItems', () => {
  it('links Donations and Jobs from the footer', () => {
    expect(footerOnlyItems.find((item) => item.label === 'Donations')?.href).toBe('/donate')
    expect(footerOnlyItems.find((item) => item.label === 'Jobs')?.href).toBe('/jobs')
  })
})
