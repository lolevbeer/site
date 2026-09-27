/**
 * The "Just Released" badge is time-based: a beer counts for 7 days after it
 * was created. Menus evaluate it against an hourly clock that is unknown
 * during server rendering, so server HTML and hydration always agree and
 * long-running menu displays still drop the badge on time.
 */
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getBeerBadgeLabel } from '@/lib/types/beer'
import { MS_PER_DAY } from '@/lib/utils/date'
import { useHourlyNow } from '@/lib/hooks/use-hourly-now'

const now = Date.parse('2026-09-27T12:00:00.000Z')
const createdDaysAgo = (days: number) => new Date(now - days * MS_PER_DAY).toISOString()

describe('getBeerBadgeLabel', () => {
  it('marks beers created within the last 7 days as just released', () => {
    expect(getBeerBadgeLabel({ createdAt: createdDaysAgo(6.9) }, now)).toBe('Just Released')
    expect(getBeerBadgeLabel({ createdAt: createdDaysAgo(7.1) }, now)).toBeNull()
  })

  it('skips only the time-based badge while the time is unknown', () => {
    expect(getBeerBadgeLabel({ createdAt: createdDaysAgo(1) }, null)).toBeNull()
    expect(getBeerBadgeLabel({ createdAt: createdDaysAgo(1), collab: true }, null)).toBe('Collab')
  })
})

describe('useHourlyNow', () => {
  function Clock() {
    const hour = useHourlyNow()
    return createElement('span', null, hour === null ? 'unknown' : 'known')
  }

  it('is unknown while server rendering and known on the client', () => {
    expect(renderToString(createElement(Clock))).toContain('unknown')
    expect(render(createElement(Clock)).container.textContent).toBe('known')
  })
})
