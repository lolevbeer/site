/**
 * Emails for a private-event inquiry from /private-events: every field, one
 * labeled line each, to events@ (subject "Event inquiry: name, event type,
 * date, taproom"; Reply goes straight to the visitor) and a short receipt to
 * the visitor (Reply goes to events@). Sent through Payload's email adapter —
 * Resend when RESEND_API_KEY is set, otherwise Payload's console logger.
 *
 * The receipt only repeats validated fields (taproom, date, headcount): it goes
 * to an address anyone can type in, so it must never carry visitor free text.
 */

import type { Payload } from 'payload'
import { sendPlainTextEmails } from '@/lib/email/send'
import {
  EVENT_INQUIRY_DRINKS,
  EVENT_INQUIRY_DURATIONS,
  EVENT_INQUIRY_FOOD_PLANS,
  EVENT_INQUIRY_YES_NO,
  occasionAdminLabel,
  optionLabel,
  type ValidatedEventInquiry,
} from '@/lib/events/inquiry'
import { formatTime } from '@/lib/utils/formatters'
import { getBaseUrl } from '@/lib/utils/get-base-url'

export const EVENTS_EMAIL = 'events@lolev.beer'

export type EventInquiryEmailInput = ValidatedEventInquiry & {
  id: string | number
  taproomName: string
}

/** Sends both emails; each is best-effort (see lib/email/send). */
export async function sendEventInquiryEmails(
  payload: Payload,
  inquiry: EventInquiryEmailInput,
): Promise<void> {
  const date = inquiry.flexibleDate ? `${inquiry.preferredDate} (flexible)` : inquiry.preferredDate
  const occasion = occasionAdminLabel(inquiry.occasion)
  const summary = `${inquiry.taproomName}, ${date}, ${inquiry.headcount} guests`

  // Every field, one per line, so a quote can go out in the first reply.
  // Blank answers show as "—" rather than disappearing.
  const fields: Array<[string, string | undefined]> = [
    ['Name', inquiry.name],
    ['Email', inquiry.email],
    ['Phone', inquiry.phone],
    ['Event type', occasion],
    ['Taproom', inquiry.taproomName],
    ['Preferred date', date],
    ['Other dates', inquiry.otherDates.join(', ')],
    ['Start time', formatTime(inquiry.startTime)],
    ['Length', optionLabel(EVENT_INQUIRY_DURATIONS, inquiry.duration)],
    ['Guests', String(inquiry.headcount)],
    ['Drinks', optionLabel(EVENT_INQUIRY_DRINKS, inquiry.drinks)],
    ['Company paying', optionLabel(EVENT_INQUIRY_YES_NO, inquiry.companyPaid)],
    ['Company name', inquiry.companyName],
    ['Food plan', optionLabel(EVENT_INQUIRY_FOOD_PLANS, inquiry.foodPlan)],
    ['Notes', inquiry.message],
  ]
  const team = [
    ...fields.map(([label, value]) => `${label}: ${value || '—'}`),
    `\nInbox: ${getBaseUrl()}/admin/collections/event-inquiries/${inquiry.id}`,
    'Reply to this email to answer the visitor.',
  ].join('\n')
  const subject = `Event inquiry: ${[
    inquiry.name,
    occasion,
    inquiry.preferredDate,
    inquiry.taproomName,
  ]
    .filter(Boolean)
    .join(', ')}`

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
        subject,
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
