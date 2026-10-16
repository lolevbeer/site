import type { Payload } from 'payload'
import type { User } from '@/src/payload-types'
import { expandRecurringEvents, mergeScheduledEvents } from '@/src/utils/recurring-events'
import { scheduleYearFilter } from '@/src/utils/recurring-food'
import type { SlackScheduleEntry } from '@/lib/slack/schedule'

export async function findUpcomingSlackEvents(
  payload: Payload,
  user: User,
  from: string,
  through: string,
): Promise<SlackScheduleEntry[]> {
  const years = [...new Set([Number(from.slice(0, 4)), Number(through.slice(0, 4))])]
  const [oneOff, recurring] = await Promise.all([
    payload.find({
      collection: 'events',
      user,
      overrideAccess: false,
      where: {
        and: [
          { date: { greater_than_equal: `${from}T00:00:00.000Z` } },
          { date: { less_than_equal: `${through}T23:59:59.999Z` } },
        ],
      },
      sort: 'date',
      pagination: false,
      limit: 0,
      depth: 1,
    }),
    payload.find({
      collection: 'recurring-events',
      user,
      overrideAccess: false,
      where: { and: [{ active: { equals: true } }, scheduleYearFilter(years)] },
      pagination: false,
      limit: 0,
      depth: 1,
    }),
  ])
  // No visibility filter: Payload decides whether the requester may see private events.
  return mergeScheduledEvents(
    oneOff.docs,
    expandRecurringEvents(recurring.docs, from, through),
    Infinity,
  ).flatMap((event) => {
    if (!event.location || typeof event.location !== 'object') return []
    return [
      {
        date: event.date.split('T')[0],
        title: event.organizer,
        location: event.location.name,
        startTime: event.startTime,
        endTime: event.endTime,
        private: event.visibility === 'private',
      },
    ]
  })
}
