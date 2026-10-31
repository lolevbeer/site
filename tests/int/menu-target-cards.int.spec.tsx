/**
 * Dashboard "Menu tracking" widget: the default 'cards' view shows one card per
 * menu, worst miss first, with a state Pill, a sparkline, and % of days on
 * target; widget data view 'chart' keeps the step-chart view.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MenuTargets } from '@/lib/admin/menu-targets'
import { sparklinePoints } from '@/lib/admin/menu-targets'
import { stockTimeline } from '@/lib/utils/menu-target'
import { MenuTargetHistory } from '@/src/components/admin/MenuTargetHistory'

const load = vi.hoisted(() => vi.fn())
vi.mock('@/lib/admin/menu-targets', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadMenuTargets: load,
}))
vi.mock('@payloadcms/ui', () => ({
  Pill: ({ children, pillStyle }: { children: ReactNode; pillStyle?: string }) => (
    <span data-pill={pillStyle}>{children}</span>
  ),
}))

const h = (n: number) => `2026-10-01T${String(n).padStart(2, '0')}:00:00.000Z`
const timeline = (counts: number[], target = 10) =>
  stockTimeline(
    counts.map((items, i) => ({ updatedAt: h(i), items })),
    target,
    Date.parse(h(counts.length)),
  )

const zel = { id: 'loc-z', name: 'Zelienople' }
const law = { id: 'loc-l', name: 'Lawrenceville' }
const menu = (id: string, name: string, type: 'draft' | 'cans', location: string) => ({
  id,
  name,
  type,
  location,
  targetItemCount: 10,
})
const data: MenuTargets = {
  rows: [
    {
      location: zel,
      atLocation: [
        menu('m-zd', 'Draft Zelienople', 'draft', zel.id),
        menu('m-zc', 'Cans To Go Zelienople', 'cans', zel.id),
      ],
      worst: 8,
    },
    {
      location: law,
      atLocation: [
        menu('m-ld', 'Draft Lawrenceville', 'draft', law.id),
        menu('m-lc', 'Cans Lawrenceville', 'cans', law.id),
      ],
      worst: 2,
    },
  ],
  end: Date.parse(h(4)),
  timelines: [
    ['m-zd', timeline([10, 10])], // on target
    ['m-zc', timeline([12, 18])], // 8 over → error
    ['m-ld', timeline([10, 8])], // 2 under, on target half the time → warning
    ['m-lc', timeline([])], // no saves
  ],
  names: [],
}

const req = { payload: { config: { routes: { admin: '/admin' } } } }
async function render(widgetData?: { view?: 'cards' | 'chart' }): Promise<string> {
  const element = await MenuTargetHistory({ req, widgetData } as never)
  return renderToStaticMarkup(element)
}

describe('MenuTargetHistory cards view', () => {
  beforeEach(() => {
    load.mockReset()
    load.mockResolvedValue(data)
  })

  it('renders one card per menu by default, worst miss first', async () => {
    const html = await render()
    const order = ['Cans To Go Zelienople', 'Draft Lawrenceville', 'Draft Zelienople'].map((name) =>
      html.indexOf(name),
    )
    expect(order.every((i) => i >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(html).toContain('18 of 10')
    expect(html).toContain('href="/admin/collections/menus/m-zc"')
    expect(html).toContain('No saves yet')
  })

  it('shows the state in a Pill styled by distance from target', async () => {
    const html = await render()
    expect(html).toContain('<span data-pill="success">On target</span>')
    expect(html).toContain('<span data-pill="warning">2 under</span>')
    expect(html).toContain('<span data-pill="error">8 over</span>')
  })

  it('labels each sparkline and shows % of days on target', async () => {
    const html = await render()
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Cans To Go Zelienople: 18 items, target 10"')
    expect(html).toContain('50% of days on target')
  })

  it('renders cards without inline style attributes', async () => {
    expect(await render({ view: 'cards' })).not.toContain('style=')
  })

  it("keeps the step chart for view 'chart'", async () => {
    const html = await render({ view: 'chart' })
    expect(html).toContain('Solid: items. Dashed: target.')
    expect(html).toContain('stroke-dasharray="4 3"')
    expect(html).not.toContain('data-pill')
  })
})

describe('sparklinePoints', () => {
  it('spaces saves evenly and scales around the target, padded by 1', () => {
    // Values 8..12 padded to 7..13 over a height of 60: 10 per item.
    expect(sparklinePoints([8, 10, 12], 10, 100, 60)).toEqual({
      points: '0,50 50,30 100,10',
      targetY: 30,
    })
  })

  it('draws a single save as a flat line across', () => {
    expect(sparklinePoints([10], 10, 100, 20).points).toBe('0,10 100,10')
  })
})
