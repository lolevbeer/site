/**
 * mailto: link for the admin "Email requester" button on a donation request.
 * Opens the staff member's own email app (so the thread lives in their inbox)
 * with the requester's address and a summary of the request filled in. The
 * long background answers stay out: some email apps drop bodies near 2,000
 * characters.
 */

import type { DonationRequest } from '@/src/payload-types'
import { getDateEST } from '@/lib/utils/date'

/** ponytail: request details clipped to keep the link short; the full text stays in Admin. */
const MAX_DETAILS = 500

type DonationSummary = Pick<
  DonationRequest,
  | 'email'
  | 'contactName'
  | 'organizationName'
  | 'askType'
  | 'eventName'
  | 'eventDate'
  | 'attendees'
  | 'venue'
  | 'taproom'
  | 'requestDetails'
>

function clip(text: string): string {
  return text.length > MAX_DETAILS ? `${text.slice(0, MAX_DETAILS)}…` : text
}

/** Null when the request has no email address to write to. */
export function donationReplyMailto(request: Partial<DonationSummary>): string | null {
  if (!request.email) return null

  const taproomNight = request.askType === 'taproom-night'
  const where = taproomNight ? request.taproom && `${request.taproom} taproom` : request.venue
  const date = request.eventDate ? getDateEST(new Date(request.eventDate)) : ''
  const details = request.requestDetails

  const body = [
    `Hi ${request.contactName ?? ''},`,
    '',
    '',
    '',
    'Your request:',
    `Organization: ${request.organizationName ?? ''}`,
    `Request type: ${taproomNight ? 'Taproom fundraiser night' : 'Product pickup'}`,
    `Event: ${[request.eventName, date].filter(Boolean).join(', ')}`,
    request.attendees ? `Estimated attendance: ${request.attendees}` : null,
    where ? `Where: ${where}` : null,
    details ? clip(details) : null,
  ]
    .filter((line) => line !== null)
    .join('\n')

  const subject = `Your Lolev donation request: ${request.eventName ?? ''}`
  return `mailto:${request.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
