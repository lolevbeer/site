/**
 * Rows for the dashboard Inbox widget: new event inquiries, donation requests,
 * and job applications merged into one list, longest waiting first. Pure (no
 * I/O): the widget reads each collection as the signed-in user and passes
 * `null` for any collection that user cannot read, which then adds no rows.
 */

import type { DonationRequest, EventInquiry, JobApplication } from '@/src/payload-types'
import { donationReplyMailto } from '@/lib/donate/reply-mailto'
import { occasionAdminLabel } from '@/lib/events/inquiry'
import { inquiryReplyMailto } from '@/lib/events/inquiry-reply-mailto'
import { jobReplyMailto } from '@/lib/jobs/application-reply-mailto'
import { getDateEST } from '@/lib/utils/date'
import { formatDate } from '@/lib/utils/formatters'

export interface InboxRow {
  id: string
  collection: 'event-inquiries' | 'donation-requests' | 'job-applications'
  kind: 'Event' | 'Donation' | 'Job'
  title: string
  /** Short summary, ' · ' joined; parts that are missing or unpopulated are left out. */
  detail: string
  createdAt: string
  /** Admin-relative path ('/collections/<slug>/<id>'); the caller adds the admin route. */
  href: string
  mailto: string | null
  /** Status the "handled" button sets. */
  handledStatus: 'contacted' | 'approved' | 'reviewed'
  handledLabel: 'Mark contacted' | 'Approve' | 'Mark reviewed'
}

/** Event day in EST, e.g. "Sat, Nov 14". */
function eventDay(iso: string | null | undefined): string | undefined {
  return iso ? formatDate(getDateEST(new Date(iso))) : undefined
}

function joinDetail(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' · ')
}

function inquiryRow(doc: EventInquiry): InboxRow {
  // An unpopulated relationship is a bare ID; leave it out rather than show it.
  const taproom = typeof doc.taproom === 'object' ? doc.taproom?.name : undefined
  return {
    id: doc.id,
    collection: 'event-inquiries',
    kind: 'Event',
    title: doc.name,
    detail: joinDetail([
      doc.occasion ? occasionAdminLabel(doc.occasion) : undefined,
      eventDay(doc.preferredDate),
      doc.headcount ? `${doc.headcount} guests` : undefined,
      taproom,
    ]),
    createdAt: doc.createdAt,
    href: `/collections/event-inquiries/${encodeURIComponent(doc.id)}`,
    mailto: inquiryReplyMailto(doc),
    handledStatus: 'contacted',
    handledLabel: 'Mark contacted',
  }
}

function donationRow(doc: DonationRequest): InboxRow {
  // `taproom` holds a raw location slug, so name the ask type instead of showing it.
  const taproom = doc.askType === 'taproom-night' ? 'Taproom night' : undefined
  return {
    id: doc.id,
    collection: 'donation-requests',
    kind: 'Donation',
    title: doc.organizationName,
    detail: joinDetail([doc.eventName, eventDay(doc.eventDate), taproom]),
    createdAt: doc.createdAt,
    href: `/collections/donation-requests/${encodeURIComponent(doc.id)}`,
    mailto: donationReplyMailto(doc),
    handledStatus: 'approved',
    handledLabel: 'Approve',
  }
}

function applicationRow(doc: JobApplication): InboxRow {
  // At depth 1 the job is populated but its location may still be a bare ID.
  const job = typeof doc.job === 'object' ? doc.job : undefined
  const location = typeof job?.location === 'object' ? job.location?.name : undefined
  return {
    id: doc.id,
    collection: 'job-applications',
    kind: 'Job',
    title: doc.name,
    detail: joinDetail([job?.title, location]),
    createdAt: doc.createdAt,
    href: `/collections/job-applications/${encodeURIComponent(doc.id)}`,
    mailto: jobReplyMailto(doc),
    handledStatus: 'reviewed',
    handledLabel: 'Mark reviewed',
  }
}

/** One list of new submissions, oldest `createdAt` first. A `null` collection adds no rows. */
export function buildInboxRows({
  inquiries,
  donations,
  applications,
}: {
  inquiries: EventInquiry[] | null
  donations: DonationRequest[] | null
  applications: JobApplication[] | null
}): InboxRow[] {
  return [
    ...(inquiries ?? []).map(inquiryRow),
    ...(donations ?? []).map(donationRow),
    ...(applications ?? []).map(applicationRow),
  ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}
