/**
 * Agenda rows show their outbound link as visible text ("Tickets ↗" for
 * ticketing sites, "Details ↗" otherwise) instead of wrapping the whole row,
 * and events (only) get an "Add to calendar" .ics link. Link names include
 * the title so a screen-reader link list can tell rows apart.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { TimelineItem } from '@/components/ui/timeline-item'
import { ScheduleList } from '@/components/ui/schedule-list'

afterEach(cleanup)

describe('TimelineItem links', () => {
  it('labels a ticketing site as Tickets and opens it in a new tab', () => {
    render(
      createElement(TimelineItem, {
        title: 'Anniversary Party',
        site: 'https://www.eventbrite.com/e/123',
      }),
    )
    const link = screen.getByRole('link', { name: /Tickets/ })
    expect(link.getAttribute('href')).toBe('https://www.eventbrite.com/e/123')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.textContent).toContain('↗')
    // The arrow is decorative, and the name says which event the link is for.
    expect(link.querySelector('[aria-hidden="true"]')?.textContent).toBe('↗')
    expect(link.textContent).toContain('for Anniversary Party')
    // The row itself is no longer a link.
    expect(screen.getByText('Anniversary Party').closest('a')).toBeNull()
  })

  it('labels any other site as Details', () => {
    render(createElement(TimelineItem, { title: 'Jazz', site: 'https://band.example.com' }))
    expect(screen.getByRole('link', { name: /Details/ })).toBeTruthy()
  })

  it('renders no links without a site or calendar', () => {
    render(createElement(TimelineItem, { title: 'Trivia' }))
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})

describe('ScheduleList calendar', () => {
  const items = [{ id: 'abc123', date: '2026-09-10', title: 'Jazz' }]

  it('adds an Add to calendar link per row when calendar is set', () => {
    render(createElement(ScheduleList, { items, calendar: true }))
    const link = screen.getByRole('link', { name: 'Add Jazz to calendar' })
    expect(link.getAttribute('href')).toBe('/events/abc123/calendar.ics')
    expect(link.getAttribute('rel')).toBe('nofollow')
  })

  it('omits the calendar link by default (food lists)', () => {
    render(createElement(ScheduleList, { items }))
    expect(screen.queryByRole('link', { name: /Add to calendar/ })).toBeNull()
  })
})
