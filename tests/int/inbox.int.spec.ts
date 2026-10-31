/**
 * Dashboard Inbox rows: new event inquiries, donation requests, and job
 * applications merged into one list, oldest waiting first.
 */
import { describe, expect, it } from 'vitest'
import type {
  DonationRequest,
  EventInquiry,
  Job,
  JobApplication,
  Location,
} from '@/src/payload-types'
import { buildInboxRows } from '@/lib/admin/inbox'
import { donationReplyMailto } from '@/lib/donate/reply-mailto'
import { inquiryReplyMailto } from '@/lib/events/inquiry-reply-mailto'
import { jobReplyMailto } from '@/lib/jobs/application-reply-mailto'

const taproom = { id: 'loc-1', name: 'Lawrenceville' } as Location

function inquiry(overrides: Partial<EventInquiry> = {}): EventInquiry {
  return {
    id: 'inq-1',
    status: 'new',
    name: 'Sam Guest',
    email: 'sam@example.org',
    occasion: 'wedding',
    preferredDate: '2026-11-14T05:00:00.000Z',
    headcount: 40,
    taproom,
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
    ...overrides,
  }
}

function donation(overrides: Partial<DonationRequest> = {}): DonationRequest {
  return {
    id: 'don-1',
    status: 'new',
    organizationName: 'Food Bank',
    askType: 'taproom-night',
    eventName: 'Fall Fundraiser',
    eventDate: '2026-12-05T05:00:00.000Z',
    attendees: 100,
    venue: '',
    taproom: 'lawrenceville',
    requestDetails: 'A night',
    contactName: 'Pat',
    email: 'pat@example.org',
    phone: '555',
    mission: 'm',
    previousDonation: 'no',
    recognition: 'r',
    whyLolev: 'w',
    howHeard: 'h',
    createdAt: '2026-10-22T12:00:00.000Z',
    updatedAt: '2026-10-22T12:00:00.000Z',
    ...overrides,
  }
}

const job = { id: 'job-1', title: 'Bartender', location: taproom } as Job

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: 'app-1',
    status: 'new',
    name: 'Alex Applicant',
    job,
    email: 'alex@example.org',
    phone: '555',
    message: 'Hire me',
    createdAt: '2026-10-25T12:00:00.000Z',
    updatedAt: '2026-10-25T12:00:00.000Z',
    ...overrides,
  }
}

describe('buildInboxRows', () => {
  it('builds an event inquiry row', () => {
    const doc = inquiry()
    const [row] = buildInboxRows({ inquiries: [doc], donations: null, applications: null })
    expect(row).toEqual({
      id: 'inq-1',
      collection: 'event-inquiries',
      kind: 'Event',
      title: 'Sam Guest',
      detail: 'Wedding or rehearsal · Sat, Nov 14 · 40 guests · Lawrenceville',
      createdAt: '2026-10-20T12:00:00.000Z',
      href: '/collections/event-inquiries/inq-1',
      mailto: inquiryReplyMailto(doc),
      handledStatus: 'contacted',
      handledLabel: 'Mark contacted',
    })
  })

  it('builds a donation request row', () => {
    const doc = donation()
    const [row] = buildInboxRows({ inquiries: null, donations: [doc], applications: null })
    expect(row).toEqual({
      id: 'don-1',
      collection: 'donation-requests',
      kind: 'Donation',
      title: 'Food Bank',
      detail: 'Fall Fundraiser · Sat, Dec 5 · Taproom night',
      createdAt: '2026-10-22T12:00:00.000Z',
      href: '/collections/donation-requests/don-1',
      mailto: donationReplyMailto(doc),
      handledStatus: 'approved',
      handledLabel: 'Approve',
    })
  })

  it('builds a job application row', () => {
    const doc = application()
    const [row] = buildInboxRows({ inquiries: null, donations: null, applications: [doc] })
    expect(row).toEqual({
      id: 'app-1',
      collection: 'job-applications',
      kind: 'Job',
      title: 'Alex Applicant',
      detail: 'Bartender · Lawrenceville',
      createdAt: '2026-10-25T12:00:00.000Z',
      href: '/collections/job-applications/app-1',
      mailto: jobReplyMailto(doc),
      handledStatus: 'reviewed',
      handledLabel: 'Mark reviewed',
    })
  })

  it('leaves unpopulated relationship IDs and missing parts out of the detail', () => {
    const rows = buildInboxRows({
      inquiries: [inquiry({ taproom: 'loc-1', occasion: null })],
      donations: [donation({ askType: 'product', taproom: null })],
      applications: [
        application({ job: 'job-1' }),
        application({ id: 'app-2', job: { ...job, location: 'loc-1' } }),
      ],
    })
    expect(rows.map((row) => row.detail)).toEqual([
      'Sat, Nov 14 · 40 guests',
      'Fall Fundraiser · Sat, Dec 5',
      '',
      'Bartender',
    ])
  })

  it('omits collections the viewer cannot read', () => {
    expect(buildInboxRows({ inquiries: null, donations: null, applications: null })).toEqual([])
    const rows = buildInboxRows({
      inquiries: [inquiry()],
      donations: null,
      applications: [application()],
    })
    expect(rows.map((row) => row.kind)).toEqual(['Event', 'Job'])
  })

  it('puts the longest-waiting submission first', () => {
    const rows = buildInboxRows({
      inquiries: [inquiry({ createdAt: '2026-10-28T12:00:00.000Z' })],
      donations: [donation({ createdAt: '2026-10-01T12:00:00.000Z' })],
      applications: [application({ createdAt: '2026-10-15T12:00:00.000Z' })],
    })
    expect(rows.map((row) => row.kind)).toEqual(['Donation', 'Job', 'Event'])
  })
})
