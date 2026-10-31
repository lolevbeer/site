/**
 * Default dashboard per role (src/admin/dashboard-layout.ts): office roles get
 * the full dashboard, bartenders their own locations' widgets only.
 */
import { describe, expect, it } from 'vitest'
import { defaultDashboardLayout } from '@/src/admin/dashboard-layout'
import type { User } from '@/src/payload-types'

const locations = [
  { id: 'law', name: 'Lawrenceville' },
  { id: 'zel', name: 'Zelienople' },
]
const menus = [
  { id: 'm-law-draft', location: 'law' },
  { id: 'm-zel-draft', location: 'zel' },
  { id: 'm-zel-cans', location: { id: 'zel' } },
]

function user(roles: string[], assigned: string[] = []): User {
  return { id: 'u1', roles, locations: assigned } as unknown as User
}

describe('defaultDashboardLayout', () => {
  it('gives office roles the full dashboard with one schedule per location', () => {
    const layout = defaultDashboardLayout({ user: user(['admin']), locations, menus })
    expect(layout.map((w) => w.widgetSlug)).toEqual([
      'needs-attention',
      'activity',
      'inbox',
      'menu-target-history',
      'schedule-heatmap',
      'schedule-heatmap',
    ])
    expect(layout.filter((w) => w.widgetSlug === 'schedule-heatmap').map((w) => w.data)).toEqual([
      { location: 'law' },
      { location: 'zel' },
    ])
  })

  it('leaves the collections grid and per-menu item lists off the office dashboard', () => {
    const slugs = defaultDashboardLayout({ user: user(['event-manager']), locations, menus }).map(
      (w) => w.widgetSlug,
    )
    expect(slugs).not.toContain('collections')
    expect(slugs).not.toContain('menu-items')
  })

  it('gives a bartender their assigned locations only: needs attention, menus, schedule', () => {
    const layout = defaultDashboardLayout({ user: user(['bartender'], ['zel']), locations, menus })
    expect(layout).toEqual([
      { widgetSlug: 'needs-attention', width: 'full' },
      { widgetSlug: 'menu-items', width: 'medium', data: { menu: 'm-zel-draft' } },
      { widgetSlug: 'menu-items', width: 'medium', data: { menu: 'm-zel-cans' } },
      { widgetSlug: 'schedule-heatmap', width: 'full', data: { location: 'zel' } },
    ])
  })

  it('treats a lead bartender like a bartender', () => {
    const layout = defaultDashboardLayout({
      user: user(['lead-bartender'], ['law']),
      locations,
      menus,
    })
    expect(layout.filter((w) => w.widgetSlug === 'menu-items')).toHaveLength(1)
    expect(layout.at(-1)).toEqual({
      widgetSlug: 'schedule-heatmap',
      width: 'full',
      data: { location: 'law' },
    })
  })

  it('gives an unassigned bartender only the needs-attention widget', () => {
    expect(defaultDashboardLayout({ user: user(['bartender']), locations, menus })).toEqual([
      { widgetSlug: 'needs-attention', width: 'full' },
    ])
  })

  it('uses the office dashboard when someone is both admin and bartender', () => {
    const layout = defaultDashboardLayout({
      user: user(['admin', 'bartender'], ['zel']),
      locations,
      menus,
    })
    expect(layout[0]).toEqual({ widgetSlug: 'needs-attention', width: 'medium' })
    expect(layout.map((w) => w.widgetSlug)).toContain('inbox')
  })
})

describe('dashboard config', () => {
  it('registers every widget the default layouts use', async () => {
    const config = await (await import('@/src/payload.config')).default
    const registered = new Set(config.admin.dashboard?.widgets.map((w) => w.slug))
    const used = [
      defaultDashboardLayout({ user: user(['admin']), locations, menus }),
      defaultDashboardLayout({ user: user(['bartender'], ['law', 'zel']), locations, menus }),
    ].flatMap((layout) => layout.map((w) => w.widgetSlug))
    expect(used.filter((slug) => !registered.has(slug))).toEqual([])
  }, 60_000)
})
