/**
 * Dashboard widget listing donation requests (filtered by the widget's status
 * setting, newest first), each row linking to the request with an "Email"
 * button that opens the staff member's email app (lib/donate/reply-mailto).
 * Payload's built-in Collection Query widget has no per-row actions, and its
 * rows are whole-row links a button cannot sit inside, hence this widget.
 */
import Link from 'next/link'
import type React from 'react'
import type { WidgetServerProps } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { donationReplyMailto } from '@/lib/donate/reply-mailto'
import type { DonationRequestsWidget as WidgetData } from '@/src/payload-types'

const LIMIT = 25

function eventDay(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

export async function DonationRequestsWidget({
  req,
  widgetData,
}: WidgetServerProps<WidgetData>): Promise<React.JSX.Element> {
  const status = widgetData?.status ?? 'new'
  const { docs } = await req.payload.find({
    collection: 'donation-requests',
    depth: 0,
    limit: LIMIT,
    sort: '-createdAt',
    where: status === 'all' ? undefined : { status: { equals: status } },
    overrideAccess: false,
    req,
  })
  const adminRoute = req.payload.config.routes.admin

  return (
    <div className="card widget-card">
      <div className="widget-card__header">
        <h3 className="widget-card__title">Donation requests</h3>
      </div>
      {docs.length === 0 ? (
        <p className="widget-card__empty">No requests.</p>
      ) : (
        <ul className="widget-card__rows">
          {docs.map((doc) => {
            const mailto = donationReplyMailto(doc)
            const day = eventDay(doc.eventDate)
            return (
              <li
                key={doc.id}
                className="widget-card__row"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Link
                  className="widget-card__row-link"
                  style={{ flex: 1, minWidth: 0 }}
                  href={formatAdminURL({
                    adminRoute,
                    path: `/collections/donation-requests/${encodeURIComponent(doc.id)}`,
                  })}
                >
                  <span className="widget-card__row-main">
                    <span className="widget-card__row-title">{doc.organizationName}</span>
                  </span>
                  {day && <span className="widget-card__row-meta">{day}</span>}
                </Link>
                {mailto && (
                  <a
                    href={mailto}
                    aria-label={`Email ${doc.contactName}`}
                    style={{ fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    Email
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
