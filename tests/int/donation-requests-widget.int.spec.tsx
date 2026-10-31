/**
 * Dashboard "Donation requests" widget: lists requests as the signed-in user,
 * filtered by the widget's status setting, each row with an edit link and an
 * "Email" mailto button (lib/donate/reply-mailto).
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DonationRequestsWidget } from '@/src/components/admin/DonationRequestsWidget'

const find = vi.fn()
const req = { payload: { find, config: { routes: { admin: '/admin' } } } }

const doc = {
  id: 'don-1',
  email: 'sam@example.org',
  contactName: 'Sam Lee',
  organizationName: 'Friends of the Park',
  askType: 'product',
  eventName: 'Fall Fundraiser',
  eventDate: '2026-11-20T17:00:00.000Z',
  attendees: 150,
  venue: 'Arsenal Park pavilion',
  requestDetails: 'Two cases',
}

async function render(widgetData?: { status?: string }) {
  const element = await DonationRequestsWidget({ req, widgetData } as never)
  return renderToStaticMarkup(element)
}

describe('DonationRequestsWidget', () => {
  beforeEach(() => {
    find.mockReset()
    find.mockResolvedValue({ docs: [doc] })
  })

  it('reads new requests as the signed-in user by default', async () => {
    await render()
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'donation-requests',
        overrideAccess: false,
        req,
        where: { status: { equals: 'new' } },
      }),
    )
  })

  it('drops the status filter for "all"', async () => {
    await render({ status: 'all' })
    expect(find.mock.calls[0][0].where).toBeUndefined()
  })

  it('links each row to the request and adds an Email button', async () => {
    const html = await render()
    expect(html).toContain('href="/admin/collections/donation-requests/don-1"')
    expect(html).toContain('Friends of the Park')
    expect(html).toContain('href="mailto:sam@example.org?subject=')
    expect(html).toContain('Email Sam Lee')
  })

  it('leaves out the Email button when the address is unsafe', async () => {
    find.mockResolvedValue({ docs: [{ ...doc, email: 'sam@example.org?cc=spy@evil.com' }] })
    expect(await render()).not.toContain('mailto:')
  })
})
