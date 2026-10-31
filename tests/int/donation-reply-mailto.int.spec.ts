/**
 * Admin "Email requester" button on a donation request: a mailto: link that
 * opens the staff member's own email app with the request summarized.
 */
import { describe, expect, it } from 'vitest'
import { donationReplyMailto } from '@/lib/donate/reply-mailto'

const request = {
  email: 'sam@example.org',
  contactName: 'Sam Lee',
  organizationName: 'Friends of the Park',
  askType: 'product' as const,
  eventName: 'Fall Fundraiser',
  eventDate: '2026-11-20T17:00:00.000Z',
  attendees: 150,
  venue: 'Arsenal Park pavilion',
  taproom: null,
  requestDetails: 'Two cases for the raffle & silent auction',
}

function parse(href: string) {
  const url = new URL(href)
  return {
    to: decodeURIComponent(url.pathname),
    subject: url.searchParams.get('subject'),
    body: url.searchParams.get('body') ?? '',
  }
}

describe('donationReplyMailto', () => {
  it('addresses the requester and summarizes the request', () => {
    const mail = parse(donationReplyMailto(request)!)
    expect(mail.to).toBe('sam@example.org')
    expect(mail.subject).toBe('Your Lolev donation request: Fall Fundraiser')
    expect(mail.body.startsWith('Hi Sam Lee,')).toBe(true)
    for (const line of [
      'Organization: Friends of the Park',
      'Request type: Product pickup',
      'Event: Fall Fundraiser, 2026-11-20',
      'Estimated attendance: 150',
      'Where: Arsenal Park pavilion',
      'Two cases for the raffle & silent auction',
    ]) {
      expect(mail.body).toContain(line)
    }
  })

  it('names the taproom for a fundraiser night', () => {
    const mail = parse(
      donationReplyMailto({
        ...request,
        askType: 'taproom-night' as const,
        venue: '',
        taproom: 'zelienople',
      })!,
    )
    expect(mail.body).toContain('Request type: Taproom fundraiser night')
    expect(mail.body).toContain('Where: zelienople taproom')
  })

  it('encodes spaces as %20, not +, so email apps do not show plus signs', () => {
    expect(donationReplyMailto(request)).not.toContain('+')
  })

  it('clips long request details so email apps do not drop the body', () => {
    const href = donationReplyMailto({ ...request, requestDetails: 'x'.repeat(4000) })!
    expect(parse(href).body).toContain(`${'x'.repeat(500)}…`)
    expect(href.length).toBeLessThan(2000)
  })

  it('returns null without an email address', () => {
    expect(donationReplyMailto({ ...request, email: '' })).toBeNull()
  })
})
