/**
 * The dashboard's Needs attention rows: line cleanings due or overdue, new
 * submissions waiting, and menus off target by more than two, in that order.
 */
import { describe, expect, it } from 'vitest'
import { buildAttentionRows, type AttentionInput } from '@/lib/admin/needs-attention'
import { MS_PER_DAY } from '@/lib/utils/date'
import type { MenuTargetSummary } from '@/lib/admin/menu-targets'

const NOW = new Date('2026-10-31T16:00:00.000Z')
const daysAgo = (days: number): string => new Date(NOW.getTime() - days * MS_PER_DAY).toISOString()

const EMPTY: AttentionInput = {
  inquiries: [],
  donations: [],
  applications: [],
  locations: [],
  menuTargets: [],
  now: NOW,
}

function summary(count: number, target: number): MenuTargetSummary {
  const diff = count - target
  return {
    count,
    target,
    diff,
    state: diff === 0 ? 'on' : diff < 0 ? 'under' : 'over',
    shareOnTarget: 50,
    series: [count],
  }
}

describe('buildAttentionRows', () => {
  it('returns no rows when nothing waits', () => {
    expect(buildAttentionRows(EMPTY)).toEqual([])
  })

  it('omits a collection the viewer cannot read', () => {
    const rows = buildAttentionRows({
      ...EMPTY,
      inquiries: null,
      donations: null,
      applications: [{ id: 'j1', createdAt: daysAgo(1) }],
    })
    expect(rows.map((r) => r.title)).toEqual(['Job applications'])
  })

  it('counts new submissions with the oldest wait', () => {
    const rows = buildAttentionRows({
      ...EMPTY,
      inquiries: [
        { id: 'i1', createdAt: daysAgo(1) },
        { id: 'i2', createdAt: daysAgo(4.5) },
        { id: 'i3', createdAt: daysAgo(2) },
      ],
      donations: [{ id: 'd1', createdAt: daysAgo(5 / 24) }],
    })
    expect(rows).toEqual([
      {
        key: 'event-inquiries',
        pillStyle: 'warning',
        pill: '3 new',
        title: 'Private event inquiries',
        meta: 'oldest 4d',
        href: '/collections/event-inquiries?where[status][equals]=new',
      },
      {
        key: 'donation-requests',
        pillStyle: 'warning',
        pill: '1 new',
        title: 'Donation requests',
        meta: 'oldest 5h',
        href: '/collections/donation-requests?where[status][equals]=new',
      },
    ])
  })

  it('says <1h for a submission waiting under an hour', () => {
    const rows = buildAttentionRows({
      ...EMPTY,
      applications: [{ id: 'a1', createdAt: daysAgo(10 / 1440) }],
    })
    expect(rows[0]?.meta).toBe('oldest <1h')
  })

  it('flags lines due soon, overdue, and never cleaned', () => {
    const rows = buildAttentionRows({
      ...EMPTY,
      locations: [
        { id: 'fresh', name: 'Fresh', linesLastCleaned: daysAgo(2) },
        { id: 'due', name: 'Lawrenceville', linesLastCleaned: daysAgo(10) },
        { id: 'late', name: 'Zelienople', linesLastCleaned: daysAgo(18) },
        { id: 'never', name: 'Nowhere', linesLastCleaned: null },
      ],
    })
    expect(rows.map((r) => [r.key, r.pillStyle, r.pill, r.meta])).toEqual([
      ['lines-never', 'error', 'Overdue', 'Never cleaned'],
      ['lines-late', 'error', 'Overdue', '18 days since cleaned'],
      ['lines-due', 'warning', 'By Nov 5', '10 days since cleaned'],
    ])
    expect(rows[1]).toMatchObject({
      title: 'Clean draft lines · Zelienople',
      href: '/collections/locations/late',
      action: { kind: 'mark-cleaned', locationId: 'late' },
    })
  })

  it('flags menus more than two off target, largest miss first', () => {
    const rows = buildAttentionRows({
      ...EMPTY,
      menuTargets: [
        { menuId: 'close', label: 'Draft · A', locationId: 'a', summary: summary(12, 10) },
        { menuId: 'under', label: 'Cans To Go · A', locationId: 'a', summary: summary(7, 10) },
        {
          menuId: 'over',
          label: 'Cans To Go · Zelienople',
          locationId: 'z',
          summary: summary(18, 10),
        },
        { menuId: 'empty', label: 'Draft · Z', locationId: 'z', summary: null },
      ],
    })
    expect(rows).toEqual([
      {
        key: 'menu-over',
        pillStyle: 'error',
        pill: '8 over',
        title: 'Cans To Go · Zelienople',
        meta: '18 of 10',
        href: '/collections/menus/over',
      },
      {
        key: 'menu-under',
        pillStyle: 'error',
        pill: '3 under',
        title: 'Cans To Go · A',
        meta: '7 of 10',
        href: '/collections/menus/under',
      },
    ])
  })

  it('orders overdue lines, due lines, submissions, then menus', () => {
    const rows = buildAttentionRows({
      ...EMPTY,
      inquiries: [{ id: 'i1', createdAt: daysAgo(1) }],
      applications: [{ id: 'j1', createdAt: daysAgo(3) }],
      locations: [
        { id: 'due', name: 'Due', linesLastCleaned: daysAgo(8) },
        { id: 'late', name: 'Late', linesLastCleaned: daysAgo(20) },
      ],
      menuTargets: [
        { menuId: 'm', label: 'Draft · Late', locationId: 'late', summary: summary(4, 10) },
      ],
    })
    expect(rows.map((r) => r.key)).toEqual([
      'lines-late',
      'lines-due',
      'job-applications',
      'event-inquiries',
      'menu-m',
    ])
  })

  it('restricts lines and menus to one location when asked', () => {
    const rows = buildAttentionRows({
      ...EMPTY,
      inquiries: [{ id: 'i1', createdAt: daysAgo(1) }],
      locations: [
        { id: 'a', name: 'A', linesLastCleaned: daysAgo(20) },
        { id: 'b', name: 'B', linesLastCleaned: daysAgo(20) },
      ],
      menuTargets: [
        { menuId: 'ma', label: 'Draft · A', locationId: 'a', summary: summary(4, 10) },
        { menuId: 'mb', label: 'Draft · B', locationId: 'b', summary: summary(4, 10) },
      ],
      locationId: 'b',
    })
    expect(rows.map((r) => r.key)).toEqual(['lines-b', 'event-inquiries', 'menu-mb'])
  })
})
