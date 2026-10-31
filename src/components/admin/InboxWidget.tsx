/**
 * Dashboard "Inbox" widget: new event inquiries, donation requests, and job
 * applications in one list (lib/admin/inbox), read as the signed-in user. A
 * collection the user may not read drops out; the others still render. The
 * widget's `kind` setting limits it to one kind (the legacy
 * 'donation-requests' slug renders donations only). The list itself, with its
 * filter tabs and row actions, is the client InboxRows.
 */
import type React from 'react'
import type { CollectionSlug, WidgetServerProps } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { buildInboxRows } from '@/lib/admin/inbox'
import type {
  DonationRequest,
  EventInquiry,
  InboxWidget as InboxWidgetData,
  JobApplication,
} from '@/src/payload-types'
import { InboxRows, type InboxKind } from './InboxRows'
import './dashboard-widgets.scss'
import './InboxWidget.scss'

/** Per collection; the oldest waiting are shown first, so a long backlog still surfaces them. */
const LIMIT = 25

type Req = WidgetServerProps['req']

/**
 * New docs of one collection as the user, or null when the read fails (most
 * often access denied), so one denied collection cannot blank the widget.
 */
async function readNew<T>(
  req: Req,
  collection: CollectionSlug,
  options: { depth: number; populate?: Record<string, Record<string, true>> },
): Promise<T[] | null> {
  try {
    const { docs } = await req.payload.find({
      collection,
      where: { status: { equals: 'new' } },
      sort: 'createdAt',
      limit: LIMIT,
      ...options,
      overrideAccess: false,
      req,
    })
    return docs as T[]
  } catch {
    return null
  }
}

export async function InboxWidget({
  req,
  widgetData,
}: WidgetServerProps<InboxWidgetData>): Promise<React.JSX.Element> {
  const kind = widgetData?.kind ?? 'all'
  const wants = (k: InboxKind): boolean => kind === 'all' || kind === k
  const [inquiries, donations, applications] = await Promise.all([
    // Depth 1 populates the taproom; only its name is shown.
    wants('events')
      ? readNew<EventInquiry>(req, 'event-inquiries', {
          depth: 1,
          populate: { locations: { name: true } },
        })
      : null,
    // No relationships are shown (`taproom` is a plain slug), so depth 0.
    wants('donations') ? readNew<DonationRequest>(req, 'donation-requests', { depth: 0 }) : null,
    // Depth 2 reaches the job's location; populate keeps it to the shown fields.
    wants('jobs')
      ? readNew<JobApplication>(req, 'job-applications', {
          depth: 2,
          populate: { jobs: { title: true, location: true }, locations: { name: true } },
        })
      : null,
  ])
  const adminRoute = req.payload.config.routes.admin
  const rows = buildInboxRows({ inquiries, donations, applications }).map((row) => ({
    ...row,
    href: formatAdminURL({ adminRoute, path: row.href as `/${string}` }),
  }))

  return (
    <div className="card widget-card lolev-widget inbox-widget">
      <div className="widget-card__header">
        <h3 className="widget-card__title">Inbox</h3>
      </div>
      <InboxRows rows={rows} kind={kind} />
    </div>
  )
}

/** The legacy 'donation-requests' widget slug: the Inbox limited to donation requests. */
export async function DonationRequestsInboxWidget(
  props: WidgetServerProps<InboxWidgetData>,
): Promise<React.JSX.Element> {
  return InboxWidget({ ...props, widgetData: { kind: 'donations' } })
}
