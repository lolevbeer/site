/**
 * Agenda rows stack time, title, and location on the center axis so
 * variable-width times cannot shove titles off-center.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { TimelineItem } from '@/components/ui/timeline-item'

afterEach(cleanup)

describe('TimelineItem stacked agenda row', () => {
  it('centers time, title, and location as separate lines', () => {
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
    expect(row.className).toContain('flex-col')
    expect(row.className).toContain('items-center')
    expect(row.className).toContain('text-center')
  })
})
