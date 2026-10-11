/**
 * With `anchors`, each ScheduleList row carries an `event-<id>` anchor so a
 * shared link (and the Event JSON-LD url) can land on that one row. Food
 * lists leave it off.
 */
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { ScheduleList } from '@/components/ui/schedule-list'

afterEach(cleanup)

describe('ScheduleList anchors', () => {
  it('gives each row an event-<id> id with scroll margin when anchors is set', () => {
    const { container } = render(
      createElement(ScheduleList, {
        anchors: true,
        items: [{ id: 'abc123', date: '2026-09-10', title: 'Thursday jazz' }],
      }),
    )
    const row = container.querySelector('#event-abc123')
    expect(row).not.toBeNull()
    expect(row?.className).toContain('scroll-mt-20')
  })

  it('adds no event- ids by default (food lists)', () => {
    const { container } = render(
      createElement(ScheduleList, {
        items: [{ id: 'abc123', date: '2026-09-10', title: 'Taco truck' }],
      }),
    )
    expect(container.querySelector('[id^="event-"]')).toBeNull()
  })
})
