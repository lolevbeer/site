/**
 * "Recurring series" block above the Events list table (the collection's
 * `beforeListTable` slot), so one-off and repeating events are managed from one
 * screen. Lists this year's and later series, one row each, linking to the
 * series' own edit form, with a "Create New Recurring" button for people who
 * may create one. Rows use the dated table's columns (RecurringEventsTable
 * keeps them aligned), with the repeat pattern and year in the Date column.
 * The dated table's search, filters and sorting do not apply to these rows.
 *
 * Reads as the signed-in viewer (overrideAccess: false), so recurring-event
 * `read` access decides which rows appear. List slots get no `req`, only a
 * `user` with the viewer's own field read access applied. That is enough here:
 * the access rule looks at roles and locations, which a user can read on
 * themselves, and a missing field could only hide rows, never reveal them.
 *
 * The list view re-renders this slot on every search, sort and page change, so
 * the read is cached per viewer and refreshed by the 'events' tag on any save.
 */
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import type React from 'react'
import type { BeforeListTableServerProps, FlattenedField, Where } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { Button } from '@payloadcms/ui'
import { accessKey, CACHE_TAGS } from '@/lib/utils/cache'
import { getTodayEST } from '@/lib/utils/date'
import { RecurringEventsTable } from '@/src/components/admin/RecurringEventsTable'
import {
  recurringSeriesRows,
  type RecurringSeries,
} from '@/src/components/admin/recurring-series-cells'
import { LEGACY_SCHEDULE_YEAR, scheduleYearFilter } from '@/src/utils/recurring-food'
import './RecurringEventsPanel.scss'

type Props = BeforeListTableServerProps

const SLUG = 'recurring-events'
// ponytail: one page, no paging; "View all" opens the full list if a year ever has more.
const LIMIT = 50

/** This year's and later series the viewer may read, cached per viewer. */
function loadSeries(
  payload: Props['payload'],
  user: Props['user'],
): Promise<{ docs: RecurringSeries[]; totalDocs: number }> {
  const thisYear = Number(getTodayEST().slice(0, 4))
  const fromThisYear: Where = { year: { greater_than_equal: thisYear } }
  // While 2026 is still in range, its filter also brings in the year-less legacy series.
  const where: Where =
    thisYear <= LEGACY_SCHEDULE_YEAR
      ? { or: [fromThisYear, scheduleYearFilter(LEGACY_SCHEDULE_YEAR)] }
      : fromThisYear

  return unstable_cache(
    async () => {
      const { docs, totalDocs } = await payload.find({
        collection: SLUG,
        where,
        // Exactly the fields of RecurringSeries (id always comes back).
        select: {
          active: true,
          organizer: true,
          year: true,
          day: true,
          occurrences: true,
          startTime: true,
          endTime: true,
          location: true,
          visibility: true,
          tags: true,
          description: true,
          summary: true,
          site: true,
          image: true,
          // Event managers only; field access leaves these out for everyone else.
          attendees: true,
          pointOfContact: true,
          email: true,
          phone: true,
          otherInfo: true,
          createdAt: true,
          updatedAt: true,
        },
        populate: { locations: { name: true }, media: { filename: true } },
        // Decides which series make the limit; recurringSeriesRows orders them for display.
        sort: ['year', 'organizer'],
        depth: 1,
        limit: LIMIT,
        overrideAccess: false,
        user,
      })
      return { docs, totalDocs }
    },
    ['recurring-events-panel-v2', accessKey({ user }), String(thisYear)],
    // Hourly fallback only; saves refresh through the tags (AGENTS.md, Caching).
    { tags: [CACHE_TAGS.events, CACHE_TAGS.locations], revalidate: 3600 },
  )()
}

/** A field's list-column heading: our labels are strings, Payload's own (dates) functions. */
function fieldLabel(field: FlattenedField, i18n: Props['i18n']): string {
  const { label } = field
  if (typeof label === 'function') return label({ i18n, t: i18n.t })
  return typeof label === 'string' ? label : ''
}

export async function RecurringEventsPanel({
  collectionConfig,
  i18n,
  listPreferences,
  payload,
  permissions,
  user,
  viewType,
}: Props): Promise<React.JSX.Element | null> {
  // Not on the trash view: trashed series live in the Recurring Events trash.
  if (viewType !== 'list') return null

  const listURL = formatAdminURL({
    adminRoute: payload.config.routes.admin,
    path: `/collections/${SLUG}`,
  })

  // Same columns as the dated table, decided the way Payload does: the viewer's
  // saved choice, else the defaults. `_select` is that table's checkbox column,
  // kept as an empty spacer here.
  const saved = listPreferences?.columns?.filter((column) => column.active) ?? []
  const initialColumns = [
    '_select',
    ...(saved.length > 0
      ? saved.map((column) => column.accessor)
      : (collectionConfig.admin.defaultColumns ?? [])),
  ]

  // This block is an extra: a failed read must not take the Events list down
  // with it, and still leaves the Create button.
  const series = await loadSeries(payload, user).catch((err: unknown) => {
    payload.logger.error({ err }, 'Recurring series block failed to load')
    return null
  })
  const rows = recurringSeriesRows(series?.docs ?? [], {
    listURL,
    dateFormat: payload.config.admin.dateFormat,
    columns: initialColumns,
    onError: (err, id) =>
      payload.logger.error({ err, id }, 'Recurring series left out of the block: bad data'),
  })
  const hasMore = series !== null && series.totalDocs > series.docs.length

  const canCreate = Boolean(permissions?.collections?.[SLUG]?.create)
  if (rows.length === 0 && !canCreate) return null

  // Header text is the dated list's own, except Date: a series has a pattern instead.
  const labels: Record<string, string> = {}
  for (const field of collectionConfig.flattenedFields) {
    labels[field.name] = fieldLabel(field, i18n)
  }
  labels.id ??= 'ID'
  labels.date = 'Repeats'

  return (
    <section className="recurring-events-panel" aria-labelledby="recurring-events-panel-title">
      <header className="recurring-events-panel__header">
        <h2 id="recurring-events-panel-title">Recurring series</h2>
        {hasMore && (
          <Link href={listURL} prefetch={false}>
            First {LIMIT} shown. View all recurring events
          </Link>
        )}
        {canCreate && (
          <Button
            buttonStyle="primary"
            el="link"
            margin={false}
            size="medium"
            to={`${listURL}/create`}
          >
            Create New Recurring
          </Button>
        )}
      </header>
      {rows.length === 0 ? (
        <p className="recurring-events-panel__empty">
          {series ? 'No recurring series this year.' : 'Recurring series could not be loaded.'}
        </p>
      ) : (
        // Keyed by the columns: with no dated table to measure, a column change
        // must still reset the table to the new server-side columns.
        <RecurringEventsTable
          initialColumns={initialColumns}
          key={initialColumns.join(',')}
          labels={labels}
          rows={rows}
        />
      )}
    </section>
  )
}
