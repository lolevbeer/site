/**
 * Rows for the dashboard's Needs attention widget, built from data the caller
 * has already read as the viewer: draft lines due or overdue for cleaning, new
 * submissions waiting in each inbox collection, and menus more than two items
 * off target. Pure; hrefs are relative to the admin route.
 */
import type { MenuTargetSummary } from '@/lib/admin/menu-targets'
import { MS_PER_DAY } from '@/lib/utils/date'
import { linesCleanedLevel } from '@/lib/utils/lines-cleaned'

/** Menus within this many items of target stay off the list. */
const MENU_TOLERANCE = 2
const MS_PER_HOUR = MS_PER_DAY / 24

type Submission = { id: string; createdAt: string }

export type AttentionInput = {
  /** New submissions per collection; null when the viewer cannot read it. */
  inquiries: Submission[] | null
  donations: Submission[] | null
  applications: Submission[] | null
  /** Locations the viewer may act on (the caller filters by role). */
  locations: { id: string; name: string; linesLastCleaned?: string | null }[]
  menuTargets: {
    menuId: string
    /** e.g. 'Cans To Go · Zelienople' */
    label: string
    locationId: string
    summary: MenuTargetSummary | null
  }[]
  now: Date
  /** Restricts line and menu rows to this location. */
  locationId?: string
}

export type AttentionRow = {
  key: string
  pillStyle: 'warning' | 'error'
  pill: string
  title: string
  meta?: string
  href: string
  action?: { kind: 'mark-cleaned'; locationId: string }
}

/** Overdue lines, due lines, waiting submissions (oldest first), then off-target menus (worst first). */
export function buildAttentionRows(input: AttentionInput): AttentionRow[] {
  const { now, locationId } = input
  const atLocation = (id: string): boolean => !locationId || id === locationId

  const lines = input.locations
    .filter((location) => atLocation(location.id))
    .map((location) => ({
      location,
      ...linesCleanedLevel(location.linesLastCleaned, now.getTime()),
    }))
    .filter((l) => l.level !== null)
    // Overdue before due; never cleaned (-1) leads its group, then most days first.
    .sort((a, b) => {
      const byLevel = Number(b.level === 'error') - Number(a.level === 'error')
      if (byLevel !== 0) return byLevel
      if (a.days === -1) return -1
      if (b.days === -1) return 1
      return b.days - a.days
    })
    .map(({ location, level, days, dueDate }): AttentionRow => ({
      key: `lines-${location.id}`,
      pillStyle: level === 'error' ? 'error' : 'warning',
      pill: level === 'error' ? 'Overdue' : `By ${dueDate}`,
      title: `Clean draft lines · ${location.name}`,
      meta: days === -1 ? 'Never cleaned' : `${days} days since cleaned`,
      href: `/collections/locations/${location.id}`,
      action: { kind: 'mark-cleaned', locationId: location.id },
    }))

  const inboxes = [
    { slug: 'event-inquiries', title: 'Private event inquiries', docs: input.inquiries },
    { slug: 'donation-requests', title: 'Donation requests', docs: input.donations },
    { slug: 'job-applications', title: 'Job applications', docs: input.applications },
  ]
  const submissions = inboxes
    .flatMap(({ slug, title, docs }) =>
      docs && docs.length > 0
        ? [
            {
              slug,
              title,
              count: docs.length,
              oldest: Math.min(...docs.map((d) => Date.parse(d.createdAt))),
            },
          ]
        : [],
    )
    .sort((a, b) => a.oldest - b.oldest)
    .map(({ slug, title, count, oldest }): AttentionRow => ({
      key: slug,
      pillStyle: 'warning',
      pill: `${count} new`,
      title,
      meta: `oldest ${formatWait(now.getTime() - oldest)}`,
      href: `/collections/${slug}?where[status][equals]=new`,
    }))

  const menus = input.menuTargets
    .flatMap(({ menuId, label, locationId, summary }) =>
      summary && atLocation(locationId) && Math.abs(summary.diff) > MENU_TOLERANCE
        ? [{ menuId, label, ...summary }]
        : [],
    )
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .map(({ menuId, label, diff, count, target }): AttentionRow => ({
      key: `menu-${menuId}`,
      pillStyle: 'error',
      pill: `${Math.abs(diff)} ${diff > 0 ? 'over' : 'under'}`,
      title: label,
      meta: `${count} of ${target}`,
      href: `/collections/menus/${menuId}`,
    }))

  return [...lines, ...submissions, ...menus]
}

/** A wait as whole days ('4d'), or whole hours under a day ('5h'). */
function formatWait(ms: number): string {
  if (ms >= MS_PER_DAY) return `${Math.floor(ms / MS_PER_DAY)}d`
  if (ms >= MS_PER_HOUR) return `${Math.floor(ms / MS_PER_HOUR)}h`
  return '<1h'
}
