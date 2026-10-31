/**
 * mailto: link for the admin "Email requester" button on a donation request,
 * built on lib/email/reply-mailto: the requester's address and a summary of
 * the request. The long background answers stay out: some email apps drop
 * bodies near 2,000 characters.
 */

import type { DonationRequest } from '@/src/payload-types'
import { clipDetails, replyMailto } from '@/lib/email/reply-mailto'
import { getDateEST } from '@/lib/utils/date'

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

/** Null when the request has no address that is safe to put in a mailto: link. */
export function donationReplyMailto(request: Partial<DonationSummary>): string | null {
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
    details ? clipDetails(details) : null,
  ]
    .filter((line) => line !== null)
    .join('\n')

  return replyMailto({
    to: request.email,
    subject: `Your Lolev donation request: ${request.eventName ?? ''}`,
    body,
  })
}
