/**
 * Dashboard "Needs attention" widget: reads new submissions, locations and menu
 * targets as the signed-in user, keeps the lines-cleaned role rule (admins every
 * location, lead bartenders their assigned ones), and renders Payload's
 * widget-card rows with a mark-cleaned button where the viewer may update the
 * location. Also a light render check of the client button and location tabs.
 */
import type React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadMenuTargets = vi.fn()
vi.mock('@/lib/admin/menu-targets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/menu-targets')>()),
  loadMenuTargets: (...args: unknown[]) => loadMenuTargets(...args),
}))

// Stand-ins for Payload's client elements: real ones need the admin providers.
vi.mock('@payloadcms/ui', () => ({
  Pill: ({ children, pillStyle }: { children: React.ReactNode; pillStyle?: string }) => (
    <span className={`pill pill--${pillStyle}`}>{children}</span>
  ),
  Button: ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" className="btn" disabled={disabled}>
      {children}
    </button>
  ),
  Tabs: ({ tabs, value }: { tabs: { label: string; value: string }[]; value: string }) => (
    <div role="tablist">
      {tabs.map((tab) => (
        <button key={tab.value} role="tab" aria-selected={tab.value === value}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { NeedsAttentionWidget } = await import('@/src/components/admin/NeedsAttentionWidget')
const { MarkCleanedRowButton } = await import('@/src/components/admin/MarkCleanedRowButton')

const NOW = Date.now()
const daysAgo = (days: number): string => new Date(NOW - days * 86_400_000).toISOString()

const locations = [
  { id: 'loc-a', name: 'Lawrenceville', linesLastCleaned: daysAgo(20) },
  { id: 'loc-z', name: 'Zelienople', linesLastCleaned: daysAgo(10) },
]

const find = vi.fn()
const config = { routes: { admin: '/admin' } }

type Viewer = { id: string; roles: string[]; locations?: string[] } | null

function makeReq(user: Viewer) {
  return { user, payload: { find, config } }
}

async function render(user: Viewer, widgetData?: { location?: string }) {
  const req = makeReq(user)
  const element = await NeedsAttentionWidget({ req, widgetData } as never)
  return { html: renderToStaticMarkup(element), req }
}

const admin: Viewer = { id: 'u-admin', roles: ['admin'] }
const lead: Viewer = { id: 'u-lead', roles: ['lead-bartender'], locations: ['loc-z'] }
const bartender: Viewer = { id: 'u-bar', roles: ['bartender'], locations: ['loc-a'] }

describe('NeedsAttentionWidget', () => {
  beforeEach(() => {
    find.mockReset()
    find.mockImplementation(async ({ collection }: { collection: string }) =>
      collection === 'locations'
        ? { docs: locations }
        : { docs: [{ id: `${collection}-1`, createdAt: daysAgo(2) }] },
    )
    loadMenuTargets.mockReset()
    loadMenuTargets.mockResolvedValue(null)
  })

  it('runs every read as the signed-in user', async () => {
    const { req } = await render(admin)
    expect(find).toHaveBeenCalledTimes(4)
    for (const [args] of find.mock.calls) {
      expect(args).toMatchObject({ overrideAccess: false, req })
    }
    for (const collection of ['event-inquiries', 'donation-requests', 'job-applications']) {
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ collection, where: { status: { equals: 'new' } } }),
      )
    }
    expect(loadMenuTargets).toHaveBeenCalledWith(req)
  })

  it('drops a collection whose read is denied and still renders the rest', async () => {
    find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'job-applications') throw new Error('Forbidden')
      return collection === 'locations'
        ? { docs: locations }
        : { docs: [{ id: `${collection}-1`, createdAt: daysAgo(2) }] }
    })
    const { html } = await render(admin)
    expect(html).not.toContain('Job applications')
    expect(html).toContain('Private event inquiries')
    expect(html).toContain('Donation requests')
  })

  it('gives admins lines rows for every location, each with a mark-cleaned button', async () => {
    const { html } = await render(admin)
    expect(html).toContain('Clean draft lines · Lawrenceville')
    expect(html).toContain('Clean draft lines · Zelienople')
    expect(html.match(/Mark cleaned/g)).toHaveLength(2)
    expect(html).toContain('href="/admin/collections/locations/loc-a"')
  })

  it('gives a lead bartender lines rows only for assigned locations', async () => {
    const { html } = await render(lead)
    expect(html).toContain('Clean draft lines · Zelienople')
    expect(html).not.toContain('Lawrenceville')
    expect(html.match(/Mark cleaned/g)).toHaveLength(1)
  })

  it('gives a plain bartender no lines rows and no button', async () => {
    const { html } = await render(bartender)
    expect(html).not.toContain('Clean draft lines')
    expect(html).not.toContain('Mark cleaned')
  })

  it('labels menu target rows by type and location', async () => {
    loadMenuTargets.mockResolvedValue({
      rows: [
        {
          location: { id: 'loc-z', name: 'Zelienople' },
          atLocation: [{ id: 'menu-1', type: 'cans', location: 'loc-z' }],
          worst: 5,
        },
      ],
      end: NOW,
      timelines: [
        [
          'menu-1',
          { segments: [{ start: 0, end: NOW, items: 5, target: 10, diff: -5 }], onTargetShare: 0 },
        ],
      ],
      names: [],
    })
    const { html } = await render(admin)
    expect(html).toContain('Cans · Zelienople')
    expect(html).toContain('5 under')
    expect(html).toContain('href="/admin/collections/menus/menu-1"')
  })

  it('pins one location from the widget setting', async () => {
    const { html } = await render(admin, { location: 'loc-z' })
    expect(html).toContain('Zelienople')
    expect(html).not.toContain('Lawrenceville')
    expect(html).not.toContain('role="tablist"')
  })

  it('gives a lead bartender with several locations tabs to switch location', async () => {
    const { html } = await render({ ...lead!, locations: ['loc-a', 'loc-z'] })
    expect(html).toContain('role="tablist"')
    // First tab selected: its lines row shows, the other location's does not.
    expect(html).toContain('Clean draft lines · Lawrenceville')
    expect(html).not.toContain('Clean draft lines · Zelienople')
  })

  it('shows no tabs to admins', async () => {
    const { html } = await render(admin)
    expect(html).not.toContain('role="tablist"')
  })

  it('renders the empty state', async () => {
    find.mockResolvedValue({ docs: [] })
    const { html } = await render(admin)
    expect(html).toContain('class="widget-card__empty"')
    expect(html).toContain('Nothing needs attention.')
    expect(html).not.toContain('widget-card__rows')
  })

  it('renders without inline style attributes', async () => {
    expect((await render(admin)).html).not.toContain('style=')
    expect((await render({ ...lead!, locations: ['loc-a', 'loc-z'] })).html).not.toContain('style=')
  })
})

describe('MarkCleanedRowButton', () => {
  it('renders a labelled button', () => {
    const html = renderToStaticMarkup(
      <MarkCleanedRowButton locationId="loc-a" rowTitle="Clean draft lines · Lawrenceville" />,
    )
    expect(html).toContain('Mark cleaned')
    expect(html).not.toContain('disabled')
  })
})
