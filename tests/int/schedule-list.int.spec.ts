/**
 * ScheduleList sorts date groups even when the caller does not.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScheduleList } from '@/components/ui/schedule-list'

vi.mock('@/lib/utils/formatters', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/formatters')>(
    '@/lib/utils/formatters',
  )
  return {
    ...actual,
    isToday: () => false,
    isTomorrow: () => false,
    formatDate: (value: string) => value,
  }
})

afterEach(cleanup)

describe('ScheduleList', () => {
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
    expect(headings[0].textContent).toBe('2026-09-10')
    expect(headings[1].textContent).toBe('2026-09-12')
  })
})
