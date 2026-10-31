/**
 * Admin "Email ..." reply buttons: the shared mailto: builder and its address
 * guard, plus the event-inquiry and job-application summaries built on it.
 */
import { describe, expect, it } from 'vitest'
import type { Job, Location } from '@/src/payload-types'
import { replyMailto } from '@/lib/email/reply-mailto'
import { inquiryReplyMailto } from '@/lib/events/inquiry-reply-mailto'
import { jobReplyMailto } from '@/lib/jobs/application-reply-mailto'

function parse(href: string) {
  const url = new URL(href)
  return {
    to: decodeURIComponent(url.pathname),
    subject: url.searchParams.get('subject'),
    body: url.searchParams.get('body') ?? '',
  }
}

describe('replyMailto', () => {
  it('URI-encodes the subject and body', () => {
    const href = replyMailto({ to: 'sam@example.org', subject: 'A & B?', body: 'line 1\nx=1&y' })
    expect(href).toBe('mailto:sam@example.org?subject=A%20%26%20B%3F&body=line%201%0Ax%3D1%26y')
  })

  it.each([
    'sam@example.org?cc=spy@evil.com',
    'sam@example.org&bcc=spy@evil.com',
    'sam@example.org%0Acc:spy@evil.com',
    'sam@example.org\ncc: spy@evil.com',
    'sam@example.org\r\nbcc: spy@evil.com',
    'sam@example.org#x',
  ])('refuses an address that would smuggle extra fields: %j', (to) => {
    expect(replyMailto({ to, subject: 's', body: 'b' })).toBeNull()
  })

  it('returns null without an address', () => {
    expect(replyMailto({ to: '', subject: 's', body: 'b' })).toBeNull()
    expect(replyMailto({ to: null, subject: 's', body: 'b' })).toBeNull()
  })
})

const inquiry = {
  name: 'Pat Kim',
  email: 'pat@example.org',
  phone: '412-555-0100',
  occasion: 'birthday' as const,
  taproom: { id: 't1', name: 'Zelienople' } as Location,
  preferredDate: '2026-12-05T05:00:00.000Z',
  flexibleDate: true,
  startTime: '18:30',
  duration: '4h' as const,
  headcount: 30,
  message: 'Back room if possible',
}

describe('inquiryReplyMailto', () => {
  it('addresses the guest and summarizes the inquiry', () => {
    const mail = parse(inquiryReplyMailto(inquiry)!)
    expect(mail.to).toBe('pat@example.org')
    expect(mail.subject).toBe('Your Lolev private event inquiry: 2026-12-05')
    expect(mail.body.startsWith('Hi Pat Kim,')).toBe(true)
    for (const line of [
      'Event type: Birthday',
      'Taproom: Zelienople',
      'Date: 2026-12-05 (flexible)',
      'Start time: 6:30pm',
      'Length: 4 hours',
      'Guests: 30',
      'Back room if possible',
    ]) {
      expect(mail.body).toContain(line)
    }
  })

  it('leaves out a taproom that is only an ID', () => {
    const mail = parse(inquiryReplyMailto({ ...inquiry, taproom: 't1' })!)
    expect(mail.body).not.toContain('Taproom:')
  })

  it('returns null without an email address', () => {
    expect(inquiryReplyMailto({ ...inquiry, email: '' })).toBeNull()
  })
})

const application = {
  name: 'Alex Ruiz',
  email: 'alex@example.org',
  phone: '412-555-0199',
  job: { id: 'j1', title: 'Bartender' } as Job,
  message: 'Five years behind the bar.',
}

describe('jobReplyMailto', () => {
  it('addresses the applicant and summarizes the application', () => {
    const mail = parse(jobReplyMailto(application)!)
    expect(mail.to).toBe('alex@example.org')
    expect(mail.subject).toBe('Your Lolev job application: Bartender')
    expect(mail.body.startsWith('Hi Alex Ruiz,')).toBe(true)
    expect(mail.body).toContain('Job: Bartender')
    expect(mail.body).toContain('Five years behind the bar.')
  })

  it('returns null without an email address', () => {
    expect(jobReplyMailto({ ...application, email: undefined })).toBeNull()
  })
})
