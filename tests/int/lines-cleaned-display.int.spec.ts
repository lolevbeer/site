/**
 * The /m draft board's "Draft lines cleaned …" note counts New York calendar
 * days from the cleaning to now. The admin button stores the exact instant, so
 * an evening cleaning is already the next day in UTC; the note must still say
 * "today" that evening, and a display left running must roll over at midnight.
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeaturedBeers } from '@/components/home/featured-menu'
import type { Menu } from '@/src/payload-types'

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: 'all' }),
}))

/** 8:30pm EDT on Sep 26, 2026, stored the way MarkLinesCleanedButton saves it. */
const CLEANED_EVENING = '2026-09-27T00:30:00.000Z'

function draftMenu(linesLastCleaned: string): Menu {
  return {
    id: 'draft-menu',
    name: 'Draft Beer',
    type: 'draft',
    location: { id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville', linesLastCleaned },
    items: [],
  } as unknown as Menu
}

/** The note under the board title, or null when it is hidden. */
const note = () => screen.queryByText(/^Draft lines cleaned/)?.textContent ?? null

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('/m draft board "lines cleaned" note', () => {
  it.each([
    ['that evening', '2026-09-26T21:00:00-04:00', 'Draft lines cleaned today'],
    ['the next day', '2026-09-27T12:00:00-04:00', 'Draft lines cleaned 1 day ago'],
    ['on day 14', '2026-10-10T12:00:00-04:00', 'Draft lines cleaned 14 days ago'],
  ])('dates an 8:30pm EDT cleaning by the New York calendar, viewed %s', (_, viewedAt, text) => {
    vi.setSystemTime(new Date(viewedAt))
    render(createElement(FeaturedBeers, { menu: draftMenu(CLEANED_EVENING) }))

    expect(note()).toBe(text)
  })

  it('hides the note from day 15, once the lines are overdue', () => {
    vi.setSystemTime(new Date('2026-10-11T12:00:00-04:00'))
    render(createElement(FeaturedBeers, { menu: draftMenu(CLEANED_EVENING) }))

    expect(note()).toBeNull()
  })

  it('rolls over to "1 day ago" at midnight on a display left running', () => {
    vi.setSystemTime(new Date('2026-09-26T23:30:00-04:00'))
    // Cleaned at 10am EDT, the same calendar day in UTC and New York.
    render(createElement(FeaturedBeers, { menu: draftMenu('2026-09-26T14:00:00.000Z') }))
    expect(note()).toBe('Draft lines cleaned today')

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000)
    })
    expect(note()).toBe('Draft lines cleaned 1 day ago')
  })

  it('leaves the note out of server HTML, so hydration always matches', () => {
    vi.setSystemTime(new Date('2026-09-26T21:00:00-04:00'))
    const html = renderToString(createElement(FeaturedBeers, { menu: draftMenu(CLEANED_EVENING) }))

    expect(html).not.toContain('Draft lines cleaned')
  })
})
