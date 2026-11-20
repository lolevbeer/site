/**
 * "Recurring food" block above the Food Bookings list table (the collection's
 * `beforeListTable` slot), so dated bookings and the monthly schedule show on
 * one screen. Lists this year's and later active Food Recurring grid slots, one
 * row per vendor, taproom and weekday ("First & Third Friday · 2026" under
 * Repeats), in the dated table's columns. Rows and the "Add Recurring" button
 * open the Food Recurring grid, where the schedule is edited; slots have no form
 * of their own. The dated table's search, filters and sorting do not apply to
 * these rows.
 *
 * Shown only to the roles the grid loads for (SCHEDULE_READER_ROLES), so every
 * row's link works; the grid's Save needs Food Recurring `update`, which also
 * gates the button. Reads as the signed-in viewer (overrideAccess: false), so
 * recurring-food-schedule `read` access still decides the rows. See
 * RecurringEventsPanel for why the slot's `user` is enough to read as.
 *
 * Paused slots are left out, as in the grid, which shows active slots only.
 */
import type React from 'react'
import type { BeforeListTableServerProps, Where } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { Button } from '@payloadcms/ui'
import { getTodayEST } from '@/lib/utils/date'
import { hasRole, SCHEDULE_READER_ROLES } from '@/src/access/roles'
import { listColumns, RecurringSeriesBlock } from '@/src/components/admin/RecurringSeriesBlock'
import {
  recurringFoodRows,
  type RecurringFoodSlot,
} from '@/src/components/admin/recurring-series-cells'
import { LEGACY_SCHEDULE_YEAR, scheduleYearFilter } from '@/src/utils/recurring-food'

type Props = BeforeListTableServerProps

const GLOBAL_SLUG = 'recurring-food'
// ponytail: at most 35 slots per taproom per year, so this covers years of
// schedule; past it, the latest years drop and the header says so.
const LIMIT = 1000

// ponytail: not cached. The tags these slots refresh under ('food',
// 'recurring-food') serve one stale read after a grid save; uncached, the block
// is fresh right after an edit, for one small indexed query per list render.
/** This year's and later active grid slots the viewer may read. */
async function loadSlots(
  payload: Props['payload'],
  user: Props['user'],
): Promise<{ slots: RecurringFoodSlot[]; hasMore: boolean }> {
  const thisYear = Number(getTodayEST().slice(0, 4))
  const fromThisYear: Where = { year: { greater_than_equal: thisYear } }
  // While 2026 is still in range, its filter also brings in year-less legacy slots.
  const years: Where =
    thisYear <= LEGACY_SCHEDULE_YEAR
      ? { or: [fromThisYear, scheduleYearFilter(LEGACY_SCHEDULE_YEAR)] }
      : fromThisYear

  const { docs, totalDocs } = await payload.find({
    collection: 'recurring-food-schedules',
    where: { and: [years, { active: { equals: true } }] },
    // Exactly the fields of RecurringFoodSlot (id always comes back).
    select: { year: true, day: true, occurrence: true, vendor: true, location: true },
    populate: { locations: { name: true }, 'food-vendors': { name: true } },
    // Earliest seasons first, so a cut at the limit drops the latest years.
    sort: 'year',
    depth: 1,
    limit: LIMIT,
    overrideAccess: false,
    user,
  })
  // Legacy slots have no stored year; they belong to the 2026 season.
  const slots = docs.map((slot) => ({ ...slot, year: slot.year ?? LEGACY_SCHEDULE_YEAR }))
  return { slots, hasMore: totalDocs > docs.length }
}

export async function RecurringFoodPanel({
  collectionConfig,
  i18n,
  listPreferences,
  payload,
  permissions,
  user,
  viewType,
}: Props): Promise<React.JSX.Element | null> {
  // Not on the trash view (the grid has no trash), nor for roles the grid refuses.
  if (viewType !== 'list' || !hasRole(user, SCHEDULE_READER_ROLES)) return null

  const gridURL = formatAdminURL({
    adminRoute: payload.config.routes.admin,
    path: `/globals/${GLOBAL_SLUG}`,
  })
  const { columns, labels } = listColumns({ collectionConfig, i18n, listPreferences })

  // An extra: a failed read must not take the Food Bookings list down with it.
  const loaded = await loadSlots(payload, user).catch((err: unknown) => {
    payload.logger.error({ err }, 'Recurring food block failed to load')
    return null
  })
  const rows = recurringFoodRows(loaded?.slots ?? [], {
    href: gridURL,
    columns,
    onError: (err, key) =>
      payload.logger.error({ err, key }, 'Recurring food left out of the block: bad data'),
  })

  const canEdit = Boolean(permissions?.globals?.[GLOBAL_SLUG]?.update)
  if (rows.length === 0 && !canEdit) return null

  return (
    <RecurringSeriesBlock
      actions={
        <>
          {loaded?.hasMore && <span>First {LIMIT} slots shown; later years are in the grid.</span>}
          {canEdit && (
            <Button buttonStyle="primary" el="link" margin={false} size="medium" to={gridURL}>
              Add Recurring
            </Button>
          )}
        </>
      }
      columns={columns}
      emptyText={loaded ? 'No recurring food this year.' : 'Recurring food could not be loaded.'}
      labels={labels}
      rows={rows}
      title="Recurring food"
    />
  )
}
