/**
 * Event rows link their title to the event's own /events/<id> page (same
 * tab). A ticketing site keeps its separate "Tickets ↗" link; any other site
 * moves to the detail page. Without detailHref (food rows), the title still
 * opens the site in a new tab.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { TimelineItem } from '@/components/ui/timeline-item'
import { ScheduleList } from '@/components/ui/schedule-list'

afterEach(cleanup)

describe('TimelineItem detailHref', () => {
  it('links the title to detailHref in the same tab', () => {
    render(createElement(TimelineItem, { title: 'Jazz', detailHref: '/events/abc' }))
    const link = screen.getByRole('link', { name: 'Jazz' })
    expect(link.getAttribute('href')).toBe('/events/abc')
    expect(link.getAttribute('target')).toBeNull()
  })

  it('keeps a separate Tickets link for a ticketing site', () => {
    render(
      createElement(TimelineItem, {
        title: 'Anniversary Party',
        site: 'https://www.eventbrite.com/e/123',
        detailHref: '/events/abc',
      }),
    )
    expect(screen.getByRole('link', { name: 'Anniversary Party' }).getAttribute('href')).toBe(
      '/events/abc',
    )
    const tickets = screen.getByRole('link', { name: /Tickets/ })
    expect(tickets.getAttribute('href')).toBe('https://www.eventbrite.com/e/123')
    expect(tickets.getAttribute('target')).toBe('_blank')
  })

  it('does not link a non-ticket site from the row', () => {
    render(
      createElement(TimelineItem, {
        title: 'Jazz',
        site: 'https://band.example.com',
        detailHref: '/events/abc',
      }),
    )
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/events/abc')
  })

  it('without detailHref, the title opens the site in a new tab', () => {
    render(createElement(TimelineItem, { title: 'Jazz', site: 'https://band.example.com' }))
    const link = screen.getByRole('link', { name: /Jazz/ })
    expect(link.getAttribute('href')).toBe('https://band.example.com/')
    expect(link.getAttribute('target')).toBe('_blank')
  })
})

describe('ScheduleList detailHref', () => {
  it('passes each item detailHref to its row', () => {
    render(
      createElement(ScheduleList, {
        items: [{ id: 'abc', date: '2026-09-10', title: 'Jazz', detailHref: '/events/abc' }],
      }),
    )
    expect(screen.getByRole('link', { name: 'Jazz' }).getAttribute('href')).toBe('/events/abc')
  })
})
