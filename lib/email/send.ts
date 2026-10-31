/**
 * Best-effort sending for public-form notification emails. Goes through
 * Payload's email adapter (Resend when RESEND_API_KEY is set, otherwise
 * Payload's console logger). A failed send is logged, never thrown, so one
 * failure cannot block the next message or the form's thank-you.
 */

import type { Payload } from 'payload'
import { escapeHtml } from '@/lib/utils/escape-html'
import { logger } from '@/lib/utils/logger'

export interface PlainTextEmail {
  to: string
  replyTo: string
  subject: string
  text: string
}

export async function sendPlainTextEmails(
  payload: Payload,
  messages: PlainTextEmail[],
  failLog: string,
): Promise<void> {
  for (const message of messages) {
    try {
      // Same text as HTML too: clients that prefer HTML would otherwise show a blank body.
      await payload.sendEmail({
        ...message,
        html: `<div style="white-space:pre-wrap">${escapeHtml(message.text)}</div>`,
      })
    } catch (error) {
      logger.error(failLog, error)
    }
  }
}
