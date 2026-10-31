/**
 * mailto: link for the admin "Email guest" reply on a private-event inquiry,
 * built on lib/email/reply-mailto: the guest's address and a summary of what
 * they asked for, so staff can quote it back. Client-safe (no server imports).
 */

import type { EventInquiry } from '@/src/payload-types'
import { clipDetails, replyMailto } from '@/lib/email/reply-mailto'
import { EVENT_INQUIRY_DURATIONS, occasionAdminLabel, optionLabel } from '@/lib/events/inquiry'
import { getDateEST } from '@/lib/utils/date'
import { formatTime } from '@/lib/utils/formatters'

/** Null when the inquiry has no address that is safe to put in a mailto: link. */
export function inquiryReplyMailto(inquiry: Partial<EventInquiry>): string | null {
  const date = inquiry.preferredDate ? getDateEST(new Date(inquiry.preferredDate)) : ''
  // An unpopulated relationship is a bare ID; leave the line out rather than show it.
  const taproom = typeof inquiry.taproom === 'object' ? inquiry.taproom?.name : undefined
  const occasion = inquiry.occasion ? occasionAdminLabel(inquiry.occasion) : undefined
  const length = optionLabel(EVENT_INQUIRY_DURATIONS, inquiry.duration)

  const body = [
    `Hi ${inquiry.name ?? ''},`,
    '',
    '',
    '',
    'Your request:',
    occasion ? `Event type: ${occasion}` : null,
    taproom ? `Taproom: ${taproom}` : null,
    date ? `Date: ${date}${inquiry.flexibleDate ? ' (flexible)' : ''}` : null,
    inquiry.startTime ? `Start time: ${formatTime(inquiry.startTime)}` : null,
    length ? `Length: ${length}` : null,
    inquiry.headcount ? `Guests: ${inquiry.headcount}` : null,
    inquiry.message ? clipDetails(inquiry.message) : null,
  ]
    .filter((line) => line !== null)
    .join('\n')

  return replyMailto({
    to: inquiry.email,
    subject: `Your Lolev private event inquiry: ${date}`,
    body,
  })
}
