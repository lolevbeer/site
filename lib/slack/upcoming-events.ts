/**
 * Events over the next N days for `/lolevbeer events`: one-off and recurring
 * events, read as the Slack requester so Payload decides private visibility.
 */
import type { Payload } from 'payload'
import type { User } from '@/src/payload-types'
import { expandRecurringEvents, mergeScheduledEvents } from '@/src/utils/recurring-events'
import { scheduleYearFilter } from '@/src/utils/recurring-food'
import type { SlackScheduleEntry } from '@/lib/slack/schedule'
import { getDateEST, getESTMidnightISO } from '@/lib/utils/date'
import { addDays, scheduleYears } from '@/lib/utils/schedule-heatmap'

export async function findUpcomingSlackEvents(
  payload: Payload,
  user: User,
  from: string,
  through: string,
): Promise<SlackScheduleEntry[]> {
  const years = scheduleYears(from, through)
  const [oneOff, recurring] = await Promise.all([
    payload.find({
      collection: 'events',
      user,
      overrideAccess: false,
      where: {
        and: [
          { date: { greater_than_equal: getESTMidnightISO(from) } },
          { date: { less_than: getESTMidnightISO(addDays(through, 1)) } },
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
        date: getDateEST(new Date(event.date)),
        title: event.organizer,
        location: event.location.name,
        startTime: event.startTime,
        endTime: event.endTime,
        private: event.visibility === 'private',
      },
    ]
  })
}
