/**
 * The layout's Suspense fallback renders FooterTaprooms without weeklyHours
 * while hours load. That loading state must not print "Hours not available",
 * the first hours text crawlers would read; only a resolved miss says so.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { PayloadLocation } from '@/lib/types/location'
import { FooterTaprooms } from '@/components/layout/footer-taprooms'

const locations = [
  {
    id: 'loc-1',
    slug: 'lawrenceville',
    name: 'Lawrenceville',
    active: true,
    address: { street: '5247 Butler Street', city: 'Pittsburgh', state: 'PA', zip: '15201' },
  },
] as PayloadLocation[]

afterEach(cleanup)

describe('FooterTaprooms hours', () => {
  it('prints no placeholder while hours are still loading', () => {
    render(<>{FooterTaprooms({ locations })}</>)
    expect(screen.getByText('Lawrenceville')).toBeTruthy()
    expect(screen.queryByText('Hours not available')).toBeNull()
  })

  it('says hours are not available once loaded hours lack the taproom', () => {
    render(<>{FooterTaprooms({ locations, weeklyHours: {} })}</>)
    expect(screen.getByText('Hours not available')).toBeTruthy()
  })
})
