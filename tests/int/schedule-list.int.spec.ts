/**
 * ScheduleList sorts date groups even when the caller does not.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScheduleList } from '@/components/ui/schedule-list'

const dayState = vi.hoisted(() => ({ today: false }))
vi.mock('@/lib/utils/formatters', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/utils/formatters')>('@/lib/utils/formatters')
  return {
    ...actual,
    isToday: () => dayState.today,
    isTodayOrFuture: (value: string) => value >= '2026-09-10',
    formatDayLabel: (value: string) => (dayState.today ? 'Today' : value),
  }
})

afterEach(() => {
  cleanup()
  dayState.today = false
})

describe('ScheduleList', () => {
  it('keeps explicit Today text with stronger heading weight', () => {
    dayState.today = true
    render(
      createElement(ScheduleList, {
        items: [{ id: 'today', date: '2026-09-10', title: 'Today event' }],
      }),
    )
    const heading = screen.getByRole('heading')
    expect(heading.textContent).toBe('Today')
    expect(heading.className).toContain('font-bold')
    expect(screen.queryByText('Up next')).toBeNull()
  })
  it('emphasizes only the nearest upcoming group, not a past group', () => {
    render(
      createElement(ScheduleList, {
        items: [
          { id: 'past', date: '2026-09-09', title: 'Past' },
          { id: 'next', date: '2026-09-10', title: 'Next' },
          { id: 'later', date: '2026-09-12', title: 'Later' },
        ],
      }),
    )
    const headings = screen.getAllByRole('heading')
    expect(headings[0].textContent).toBe('2026-09-09')
    expect(headings[1].textContent).toContain('Up next')
    expect(headings[2].textContent).not.toContain('Up next')
  })

  it('renders later dates after earlier dates', () => {
    render(
      createElement(ScheduleList, {
        items: [
          { id: '2', date: '2026-09-12', title: 'Saturday trivia' },
          { id: '1', date: '2026-09-10', title: 'Thursday jazz' },
        ],
      }),
    )
    const headings = screen.getAllByRole('heading')
    expect(headings[0].textContent).toContain('2026-09-10')
    expect(headings[1].textContent).toBe('2026-09-12')
  })
})
