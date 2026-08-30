/**
 * SectionHeader renders "Title · Location" so the homepage Food and Events
 * sections name the taproom they are filtered to, matching the Draft/Cans
 * headings in featured-menu.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { SectionHeader } from '@/components/ui/section-header'

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))

afterEach(cleanup)

describe('SectionHeader', () => {
  it('appends the location name to the title', () => {
    render(createElement(SectionHeader, { title: 'Food', locationName: 'Lawrenceville' }))

    expect(screen.getByRole('heading').textContent).toBe('Food · Lawrenceville')
  })

  it('shows the title alone when no location is selected', () => {
    render(createElement(SectionHeader, { title: 'Events' }))

    expect(screen.getByRole('heading').textContent).toBe('Events')
  })
})
