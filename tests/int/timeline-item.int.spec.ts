/**
 * Agenda rows keep a time column, wrapping titles, and safe external links.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { TimelineItem } from '@/components/ui/timeline-item'

afterEach(cleanup)

describe('TimelineItem aligned agenda row', () => {
  it.each([undefined, 'TBD'])('omits unknown time %s while retaining the title', (time) => {
    render(createElement(TimelineItem, { title: 'Untimed event', time }))
    expect(screen.getByText('Untimed event')).toBeTruthy()
    expect(screen.queryByText('TBD')).toBeNull()
  })
  it('retains formatted ranges and safe links without truncating long titles', () => {
    const title = 'A long event title that should wrap rather than disappear'
    render(
      createElement(TimelineItem, {
        title,
        time: '17:00',
        endTime: '20:00',
        site: 'https://example.com',
      }),
    )
    expect(screen.getByText('5pm–8pm')).toBeTruthy()
    expect(screen.getByText(title).className).not.toContain('truncate')
    const link = screen.getByRole('link')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.getAttribute('href')).toBe('https://example.com/')
  })
  it('does not link unsafe destinations', () => {
    render(createElement(TimelineItem, { title: 'Unsafe', site: 'javascript:alert(1)' }))
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('aligns time and title while retaining location', () => {
    const { container } = render(
      createElement(TimelineItem, {
        title: "Drew's Clues Trivia",
        time: '19:00',
        location: 'Lawrenceville',
      }),
    )

    expect(screen.getByText("Drew's Clues Trivia")).toBeTruthy()
    expect(screen.getByText('7pm')).toBeTruthy()
    expect(screen.getByText('Lawrenceville')).toBeTruthy()

    const row = container.firstElementChild as HTMLElement
    expect(row.className).toContain('grid-cols-[7rem_minmax(0,1fr)]')
    expect(row.className).toContain('text-left')
  })
})
