/**
 * Dashboard Inbox widget: the server part reads new submissions as the
 * signed-in user (a denied collection drops out, the rest still render, and
 * the widget's `kind` setting limits what is read); the client list filters by
 * kind with Payload Tabs and marks a row handled with a PATCH as the user.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { InboxRow } from '@/lib/admin/inbox'
import { DonationRequestsInboxWidget, InboxWidget } from '@/src/components/admin/InboxWidget'
import { InboxRows } from '@/src/components/admin/InboxRows'

const state = vi.hoisted(() => ({
  refresh: vi.fn(),
  openDrawer: vi.fn(),
  drawerArgs: [] as Array<{ collectionSlug: string; id?: string }>,
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }))
vi.mock('@payloadcms/ui', () => ({
  toast: state.toast,
  useTranslation: () => ({ i18n: { language: 'en' } }),
  useDocumentDrawer: (args: { collectionSlug: string; id?: string }) => {
    state.drawerArgs.push(args)
    return [
      () => null,
      () => null,
      { openDrawer: state.openDrawer, closeDrawer: vi.fn(), isDrawerOpen: false },
    ]
  },
  Tabs: ({
    tabs,
    onChange,
  }: {
    tabs: Array<{ label: ReactNode; value: string }>
    onChange: (value: string) => void
    value: string
  }) => (
    <div role="tablist">
      {tabs.map((tab) => (
        <button key={tab.value} role="tab" type="button" onClick={() => onChange(tab.value)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
  Button: ({
    buttonStyle: _style,
    size: _size,
    ...props
  }: ComponentProps<'button'> & { buttonStyle?: string; size?: string }) => <button {...props} />,
}))

const location = { id: 'loc-1', name: 'Lawrenceville' }
const inquiry = {
  id: 'inq-1',
  status: 'new',
  name: 'Sam Guest',
  email: 'sam@example.org',
  preferredDate: '2026-11-14T05:00:00.000Z',
  headcount: 40,
  taproom: location,
  createdAt: '2026-10-20T12:00:00.000Z',
}
const donation = {
  id: 'don-1',
  status: 'new',
  organizationName: 'Food Bank',
  askType: 'product',
  eventName: 'Fall Fundraiser',
  eventDate: '2026-12-05T05:00:00.000Z',
  contactName: 'Pat',
  email: 'pat@example.org',
  createdAt: '2026-10-22T12:00:00.000Z',
}
const application = {
  id: 'app-1',
  status: 'new',
  name: 'Alex Applicant',
  email: 'alex@example.org',
  job: { id: 'job-1', title: 'Bartender', location },
  createdAt: '2026-10-24T12:00:00.000Z',
}
const docsBySlug: Record<string, unknown[]> = {
  'event-inquiries': [inquiry],
  'donation-requests': [donation],
  'job-applications': [application],
}

const find = vi.fn()
const req = { payload: { find, config: { routes: { admin: '/admin' } } } }

async function renderWidget(kind?: string): Promise<string> {
  const element = await InboxWidget({ req, widgetData: kind ? { kind } : undefined } as never)
  return renderToStaticMarkup(element)
}

beforeEach(() => {
  find.mockReset()
  find.mockImplementation(async ({ collection }: { collection: string }) => ({
    docs: docsBySlug[collection],
  }))
  state.refresh.mockReset()
  state.openDrawer.mockReset()
  state.drawerArgs = []
  state.toast.success.mockReset()
  state.toast.error.mockReset()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('InboxWidget (server)', () => {
  it('reads new submissions from all three collections as the signed-in user', async () => {
    await renderWidget()
    expect(find.mock.calls.map(([args]) => args.collection).sort()).toEqual([
      'donation-requests',
      'event-inquiries',
      'job-applications',
    ])
    for (const [args] of find.mock.calls) {
      expect(args).toMatchObject({
        overrideAccess: false,
        req,
        where: { status: { equals: 'new' } },
      })
    }
  })

  it('omits a collection the user may not read and still renders the others', async () => {
    find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'job-applications') throw new Error('Forbidden')
      return { docs: docsBySlug[collection] }
    })
    const html = await renderWidget()
    expect(html).toContain('Sam Guest')
    expect(html).toContain('Food Bank')
    expect(html).not.toContain('Alex Applicant')
  })

  it("reads and shows only donations when the widget's kind is donations", async () => {
    const html = await renderWidget('donations')
    expect(find.mock.calls.map(([args]) => args.collection)).toEqual(['donation-requests'])
    expect(html).toContain('Food Bank')
    expect(html).not.toContain('role="tablist"')
  })

  it('renders the legacy donation-requests widget as donations only, ignoring its old status setting', async () => {
    const element = await DonationRequestsInboxWidget({
      req,
      widgetData: { status: 'all' },
    } as never)
    expect(find.mock.calls.map(([args]) => args.collection)).toEqual(['donation-requests'])
    expect(renderToStaticMarkup(element)).toContain('Food Bank')
  })

  it('prefixes row links with the admin route and adds Email links', async () => {
    const html = await renderWidget()
    expect(html).toContain('href="/admin/collections/event-inquiries/inq-1"')
    expect(html).toContain('href="mailto:sam@example.org')
    expect(html).toContain('Mark contacted')
  })

  it('renders without inline style attributes', async () => {
    expect(await renderWidget()).not.toContain('style=')
  })

  it('shows the empty state when nothing is waiting', async () => {
    find.mockResolvedValue({ docs: [] })
    expect(await renderWidget()).toContain('Nothing waiting.')
  })
})

function row(overrides: Partial<InboxRow>): InboxRow {
  return {
    id: 'inq-1',
    collection: 'event-inquiries',
    kind: 'Event',
    title: 'Sam Guest',
    detail: 'Wedding',
    createdAt: '2026-10-20T12:00:00.000Z',
    href: '/admin/collections/event-inquiries/inq-1',
    mailto: null,
    handledStatus: 'contacted',
    handledLabel: 'Mark contacted',
    ...overrides,
  }
}

const rows: InboxRow[] = [
  row({}),
  row({
    id: 'don-1',
    collection: 'donation-requests',
    kind: 'Donation',
    title: 'Food Bank',
    href: '/admin/collections/donation-requests/don-1',
    handledStatus: 'approved',
    handledLabel: 'Approve',
  }),
  row({
    id: 'app-1',
    collection: 'job-applications',
    kind: 'Job',
    title: 'Alex Applicant',
    href: '/admin/collections/job-applications/app-1',
    handledStatus: 'reviewed',
    handledLabel: 'Mark reviewed',
  }),
]

describe('InboxRows (client)', () => {
  it('labels the tabs with counts and filters rows by kind', () => {
    render(<InboxRows rows={rows} kind="all" />)
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs).toEqual(['All (3)', 'Events (1)', 'Donations (1)', 'Jobs (1)'])
    fireEvent.click(screen.getByRole('tab', { name: 'Donations (1)' }))
    expect(screen.queryByText('Sam Guest')).toBeNull()
    expect(screen.getByText('Food Bank')).toBeTruthy()
  })

  it.each([
    ['Mark contacted', '/api/event-inquiries/inq-1', 'contacted'],
    ['Approve', '/api/donation-requests/don-1', 'approved'],
    ['Mark reviewed', '/api/job-applications/app-1', 'reviewed'],
  ])('"%s" PATCHes %s as the user, then refreshes', async (label, url, status) => {
    render(<InboxRows rows={rows} kind="all" />)
    fireEvent.click(screen.getByRole('button', { name: label }))
    await waitFor(() => expect(state.toast.success).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith(url, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    expect(state.refresh).toHaveBeenCalled()
  })

  it('shows an error toast and does not refresh when the PATCH fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 403 } as Response)
    render(<InboxRows rows={rows} kind="all" />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(state.toast.error).toHaveBeenCalled())
    expect(state.toast.success).not.toHaveBeenCalled()
    expect(state.refresh).not.toHaveBeenCalled()
  })

  it("opens the row's document in Payload's drawer from its title", () => {
    render(<InboxRows rows={rows} kind="all" />)
    expect(state.drawerArgs).toContainEqual({ collectionSlug: 'donation-requests', id: 'don-1' })
    fireEvent.click(screen.getByRole('link', { name: 'Food Bank' }))
    expect(state.openDrawer).toHaveBeenCalled()
  })
})
