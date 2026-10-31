/**
 * Emails for a private-event inquiry from /private-events: the full request to
 * events@ (Reply goes straight to the visitor) and a short receipt to the
 * visitor (Reply goes to events@). Sent through Payload's email adapter —
 * Resend when RESEND_API_KEY is set, otherwise Payload's console logger.
 *
 * The receipt only repeats validated fields (taproom, date, headcount): it goes
 * to an address anyone can type in, so it must never carry visitor free text.
 */

import type { Payload } from 'payload'
import { sendPlainTextEmails } from '@/lib/email/send'
import { occasionAdminLabel } from '@/lib/events/inquiry'
import { getBaseUrl } from '@/lib/utils/get-base-url'

export const EVENTS_EMAIL = 'events@lolev.beer'

export interface EventInquiryEmailInput {
  id: string | number
  name: string
  email: string
  phone?: string
  preferredDate: string
  flexibleDate?: boolean
  otherDates?: string[]
  headcount: number
  occasion?: string
  taproomName: string
  message?: string
}

/** Sends both emails; each is best-effort (see lib/email/send). */
export async function sendEventInquiryEmails(
  payload: Payload,
  inquiry: EventInquiryEmailInput,
): Promise<void> {
  const date = inquiry.flexibleDate ? `${inquiry.preferredDate} (flexible)` : inquiry.preferredDate
  const occasion = inquiry.occasion ? occasionAdminLabel(inquiry.occasion) : undefined
  const summary = `${inquiry.taproomName}, ${date}, ${inquiry.headcount} guests`

  const team = [
    `Name: ${inquiry.name}`,
    `Email: ${inquiry.email}`,
    inquiry.phone && `Phone: ${inquiry.phone}`,
    `Taproom: ${inquiry.taproomName}`,
    `Preferred date: ${date}`,
    inquiry.otherDates?.length && `Also works: ${inquiry.otherDates.join(', ')}`,
    `Guests: ${inquiry.headcount}`,
    occasion && `Occasion: ${occasion}`,
    inquiry.message && `\n${inquiry.message}`,
    `\nInbox: ${getBaseUrl()}/admin/collections/event-inquiries/${inquiry.id}`,
    'Reply to this email to answer the visitor.',
  ]
    .filter(Boolean)
    .join('\n')

  const receipt = [
    `Thanks for asking about a private event at ${summary}.`,
    'Our events team will get back to you. Reply to this email if anything changes.',
    '',
    'Lolev Beer',
  ].join('\n')

  await sendPlainTextEmails(
    payload,
    [
      {
        to: EVENTS_EMAIL,
        replyTo: inquiry.email,
        subject: `Private event inquiry: ${summary}`,
        text: team,
      },
      {
        to: inquiry.email,
        replyTo: EVENTS_EMAIL,
        subject: 'We got your private event request',
        text: receipt,
      },
    ],
    'Event inquiry email failed',
  )
}
