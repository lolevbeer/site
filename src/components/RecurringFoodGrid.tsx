'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Banner,
  Button,
  ConfirmationModal,
  Pill,
  RelationshipInput,
  ShimmerEffect,
  useAuth,
  useModal,
} from '@payloadcms/ui'
// Styles live in RecurringFoodGrid.scss, pulled in via the admin's custom.scss
// (a direct import here would drag SCSS through the vitest pipeline).
import type { ValueWithRelation } from 'payload'
import {
  getActiveLocations,
  getFoodForLocationYear,
  getFoodVendorsByIds,
  getRecurringFoodData,
  setRecurringFoodExclusion,
  setRecurringFoodSchedule,
  type SimpleLocation,
} from '@/src/actions/admin-data'
import { isFoodManager } from '@/src/access/roles'
import {
  RECURRING_YEAR_MAX,
  RECURRING_YEAR_MIN,
  recurringDays as days,
  recurringOccurrences as weeks,
} from '@/src/utils/recurring-food'
import { capitalizeName } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import { getDatesForSlotInYear, toDateKey } from '@/lib/utils/food-dates'
import { logger } from '@/lib/utils/logger'
import type { User } from '@/src/payload-types'

// Derived so the labels can't fall out of index alignment with `days`.
const fullDayLabels = days.map(capitalizeName)
const dayLabels = fullDayLabels.map((label) => label.slice(0, 3))
const weekOrdinals = ['1st', '2nd', '3rd', '4th', '5th']

type Day = (typeof days)[number]
type Week = (typeof weeks)[number]

type LocationSchedule = Partial<Record<Day, Partial<Record<Week, string | null>>>>
type SchedulesData = Record<string, LocationSchedule>

/** Shared empty result, so deriving one keeps a stable identity across renders. */
const EMPTY_SCHEDULES: SchedulesData = {}
type ExclusionsData = Record<string, string[]>
type Location = SimpleLocation

/** Number of filled slots in one location's `{day: {week: vendorId}}` map. */
function countSlots(locationSchedule: LocationSchedule | undefined): number {
  return Object.values(locationSchedule || {}).reduce(
    (total, byWeek) => total + Object.values(byWeek || {}).filter(Boolean).length,
    0,
  )
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Re-exported for the grid's tests, which assert the local-calendar-day keying
// this component relies on.
export { toDateKey } from '@/lib/utils/food-dates'

/**
 * Keys identifying a single in-flight write. Each control locks only on its own
 * key, so one slow save never freezes the rest of the grid.
 */
function scheduleSaveKey(year: number, locationId: string, day: string, week: string): string {
  return `${year}-${locationId}-${day}-${week}`
}

function exclusionSaveKey(locationId: string, dateKey: string): string {
  return `exclusion-${locationId}-${dateKey}`
}

interface GridCellProps {
  value: string | null
  onChange: (vendorId: string | null) => void
  cellKey: string
  readOnly?: boolean
}

const GridCell: React.FC<GridCellProps> = ({ value, onChange, cellKey, readOnly }) => {
  const handleChange = useCallback(
    (newValue: ValueWithRelation | null) => {
      if (newValue && typeof newValue === 'object' && 'value' in newValue) {
        onChange(newValue.value as string)
      } else {
        onChange(null)
      }
    },
    [onChange],
  )

  const valueWithRelation: ValueWithRelation | null = value
    ? { relationTo: 'food-vendors', value }
    : null

  return (
    <RelationshipInput
      path={`cell-${cellKey}`}
      relationTo={['food-vendors']}
      hasMany={false}
      // No create/edit vendor affordances in cells — both are rare and eat
      // space the (truncated) name needs; manage vendors in their collection.
      // Payload's own SingleValue renders the full name as a hover tooltip.
      allowCreate={false}
      allowEdit={false}
      value={valueWithRelation}
      onChange={handleChange}
      appearance="select"
      placeholder="Select"
      readOnly={readOnly}
    />
  )
}

interface ScheduledDate {
  date: Date
  dayIndex: number
  weekIndex: number
  vendorId: string
  vendorName?: string
  type: 'recurring' | 'individual'
  foodDocId?: string
}

interface DatesListProps {
  year: number
  locationId: string
  schedules: SchedulesData
  exclusions: ExclusionsData
  onExclusionChange: (locationId: string, date: string, excluded: boolean) => Promise<void>
  /** Keys of the writes currently in flight; see `exclusionSaveKey` above. */
  pendingKeys: ReadonlySet<string>
  readOnly: boolean
  /** Lets the empty state offer a jump to a year that has schedules. */
  onYearChange: (year: number) => void
  /** Slots this location has in `year - 1`; drives the empty-state hint. */
  previousYearSlots: number
}

const EXCLUSION_MODAL_SLUG = 'confirm-exclusion'

const DatesList: React.FC<DatesListProps> = ({
  year,
  locationId,
  schedules,
  exclusions,
  onExclusionChange,
  pendingKeys,
  readOnly,
  onYearChange,
  previousYearSlots,
}) => {
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({})
  const [individualFoodEvents, setIndividualFoodEvents] = useState<ScheduledDate[]>([])
  const [pendingToggle, setPendingToggle] = useState<{
    date: Date
    vendorName: string
    isExcluded: boolean
  } | null>(null)
  const mountedRootRef = useRef<HTMLDivElement | null>(null)
  const { openModal, closeModal } = useModal()

  const locationExclusions = useMemo(() => exclusions[locationId] || [], [exclusions, locationId])
  const locationSchedule = useMemo(() => schedules[locationId] || {}, [schedules, locationId])

  const recurringDates = useMemo(() => {
    const dates: ScheduledDate[] = []

    days.forEach((day, dayIndex) => {
      weeks.forEach((week, weekIndex) => {
        const vendorId = locationSchedule[day]?.[week]

        if (vendorId) {
          const yearDates = getDatesForSlotInYear(dayIndex, weekIndex + 1, year)
          yearDates.forEach((date) => {
            dates.push({ date, dayIndex, weekIndex, vendorId, type: 'recurring' })
          })
        }
      })
    })

    return dates
  }, [locationSchedule, year])

  useEffect(() => () => closeModal(EXCLUSION_MODAL_SLUG), [closeModal])

  // Fetch individual food events using server action (local API)
  useEffect(() => {
    let cancelled = false

    const fetchIndividualEvents = async () => {
      try {
        const foodEvents = await getFoodForLocationYear(locationId, year)
        if (cancelled) return

        const events: ScheduledDate[] = foodEvents.map((doc) => {
          const date = new Date(doc.date)
          return {
            date,
            dayIndex: date.getDay(),
            weekIndex: Math.ceil(date.getDate() / 7) - 1,
            vendorId: doc.vendorId,
            vendorName: doc.vendorName,
            type: 'individual' as const,
            foodDocId: doc.id,
          }
        })
        setIndividualFoodEvents(events)
      } catch (error) {
        if (!cancelled) logger.error('Error fetching individual food events:', error)
      }
    }

    void fetchIndividualEvents()
    return () => {
      cancelled = true
    }
  }, [locationId, year])

  const scheduledDates = useMemo(
    () =>
      [...recurringDates, ...individualFoodEvents].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      ),
    [recurringDates, individualFoodEvents],
  )

  // Keyed on the joined id string, not the array: `recurringDates` gets a fresh
  // identity after every save (including exclusion toggles, which cannot change
  // vendors at all), and refetching identical ids would re-render the list.
  const vendorIdKey = useMemo(
    () => [...new Set(recurringDates.map((d) => d.vendorId))].sort().join(','),
    [recurringDates],
  )
  useEffect(() => {
    if (!vendorIdKey) return

    let cancelled = false
    const fetchVendors = async () => {
      try {
        const names = await getFoodVendorsByIds(vendorIdKey.split(','))
        if (!cancelled) setVendorNames(names)
      } catch (error) {
        if (!cancelled) logger.error('Error fetching vendor names:', error)
      }
    }

    void fetchVendors()
    return () => {
      cancelled = true
    }
  }, [vendorIdKey])

  const requestToggleExclusion = useCallback(
    (date: Date, vendorName: string) => {
      const dateKey = toDateKey(date)
      const isCurrentlyExcluded = locationExclusions.includes(dateKey)

      setPendingToggle({ date, vendorName, isExcluded: isCurrentlyExcluded })
      openModal(EXCLUSION_MODAL_SLUG)
    },
    [locationExclusions, openModal],
  )

  const confirmToggleExclusion = useCallback(async () => {
    if (!mountedRootRef.current || !pendingToggle) return

    const dateKey = toDateKey(pendingToggle.date)
    try {
      await onExclusionChange(locationId, dateKey, !pendingToggle.isExcluded)
      closeModal(EXCLUSION_MODAL_SLUG)
      setPendingToggle(null)
    } catch {
      // The parent renders the actionable error and restores server state.
    }
  }, [pendingToggle, locationId, onExclusionChange, closeModal])

  const cancelToggleExclusion = useCallback(() => {
    closeModal(EXCLUSION_MODAL_SLUG)
    setPendingToggle(null)
  }, [closeModal])

  const isExcluded = useCallback(
    (date: Date): boolean => {
      const dateKey = toDateKey(date)
      return locationExclusions.includes(dateKey)
    },
    [locationExclusions],
  )

  // Find conflicts
  const conflicts = useMemo(() => {
    const dateMap: Record<string, { recurring: ScheduledDate[]; individual: ScheduledDate[] }> = {}

    scheduledDates.forEach((item) => {
      const dateKey = toDateKey(item.date)
      if (!dateMap[dateKey]) dateMap[dateKey] = { recurring: [], individual: [] }

      if (item.type === 'recurring' && !isExcluded(item.date)) {
        dateMap[dateKey].recurring.push(item)
      } else if (item.type === 'individual') {
        dateMap[dateKey].individual.push(item)
      }
    })

    const conflictList: { date: Date; recurringVendor: string; individualVendor: string }[] = []

    Object.values(dateMap).forEach((items) => {
      if (items.recurring.length > 0 && items.individual.length > 0) {
        items.recurring.forEach((r) => {
          items.individual.forEach((i) => {
            conflictList.push({
              date: r.date,
              recurringVendor: vendorNames[r.vendorId] || r.vendorName || 'Unknown',
              individualVendor: i.vendorName || vendorNames[i.vendorId] || 'Unknown',
            })
          })
        })
      }
    })

    return conflictList
  }, [scheduledDates, vendorNames, isExcluded])

  // Group dates by month
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, ScheduledDate[]> = {}
    scheduledDates.forEach((item) => {
      const monthKey = item.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      if (!groups[monthKey]) groups[monthKey] = []
      groups[monthKey].push(item)
    })
    return groups
  }, [scheduledDates])

  const restoring = Boolean(pendingToggle?.isExcluded)
  const exclusionModal = (
    <ConfirmationModal
      modalSlug={EXCLUSION_MODAL_SLUG}
      heading={restoring ? 'Remove Exclusion' : 'Exclude Event'}
      body={
        pendingToggle
          ? `Are you sure you want to ${restoring ? 'restore' : 'exclude'} "${pendingToggle.vendorName}" on ${formatDate(pendingToggle.date)}?`
          : ''
      }
      confirmLabel={restoring ? 'Restore' : 'Exclude'}
      onConfirm={confirmToggleExclusion}
      onCancel={cancelToggleExclusion}
    />
  )

  if (scheduledDates.length === 0) {
    return (
      <div ref={mountedRootRef} className="recurring-food-grid__empty">
        {exclusionModal}
        <div>No vendors scheduled. Select vendors in the grid above to see upcoming dates.</div>
        {previousYearSlots > 0 && (
          <div className="recurring-food-grid__empty-hint">
            {previousYearSlots} slot{previousYearSlots === 1 ? '' : 's'} scheduled for {year - 1}.{' '}
            <Button
              buttonStyle="none"
              className="recurring-food-grid__link-button"
              onClick={() => onYearChange(year - 1)}
            >
              View {year - 1}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={mountedRootRef} className="recurring-food-grid__dates">
      {exclusionModal}
      {conflicts.length > 0 && (
        <div className="recurring-food-grid__conflicts">
          <strong>Conflicts:</strong>
          <div className="recurring-food-grid__conflict-list">
            {conflicts.map((conflict) => (
              <div
                key={`${toDateKey(conflict.date)}-${conflict.recurringVendor}-${conflict.individualVendor}`}
                className="recurring-food-grid__conflict"
              >
                <strong>{formatDate(conflict.date)}</strong>: {conflict.recurringVendor} (recurring)
                + {conflict.individualVendor} (scheduled)
              </div>
            ))}
          </div>
        </div>
      )}
      <h4 className="recurring-food-grid__dates-heading">
        {year} Schedule
        {!readOnly && <span className="recurring-food-grid__dates-hint">(click to exclude)</span>}
      </h4>
      <div className="recurring-food-grid__dates-list">
        {Object.entries(groupedByMonth).map(([month, dates]) => (
          <div key={month} className="recurring-food-grid__month">
            <div className="recurring-food-grid__month-label">{month}</div>
            {dates.map((item, idx) => {
              const excluded = item.type === 'recurring' && isExcluded(item.date)
              const isIndividual = item.type === 'individual'
              // Only the date being written is locked; the rest of the list
              // stays clickable so the save queue can actually queue.
              const isPending = pendingKeys.has(exclusionSaveKey(locationId, toDateKey(item.date)))
              const isDisabled = isIndividual || isPending || readOnly
              const displayName = item.vendorName || vendorNames[item.vendorId] || '...'
              const rowClassNames = cn(
                'recurring-food-grid__date-row',
                excluded && 'recurring-food-grid__date-row--excluded',
                isIndividual && 'recurring-food-grid__date-row--individual',
              )
              const ariaLabel =
                isIndividual || readOnly
                  ? undefined
                  : `${excluded ? 'Restore' : 'Exclude'} ${displayName} on ${formatDate(item.date)}`

              return (
                <button
                  key={`${item.date.toISOString()}-${idx}-${item.type}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => requestToggleExclusion(item.date, displayName)}
                  aria-label={ariaLabel}
                  className={rowClassNames}
                >
                  <span className="recurring-food-grid__date-text">
                    <strong>{formatDate(item.date)}</strong> {displayName}
                  </span>{' '}
                  {isIndividual ? (
                    <Pill pillStyle="success" size="small">
                      Scheduled
                    </Pill>
                  ) : (
                    <span className="recurring-food-grid__slot-note">
                      ({weekOrdinals[item.weekIndex]} {fullDayLabels[item.dayIndex]})
                    </span>
                  )}
                  {excluded && (
                    <Pill pillStyle="error" size="small">
                      Excluded
                    </Pill>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

interface LocationGridProps {
  year: number
  location: Location
  schedules: SchedulesData
  exclusions: ExclusionsData
  onScheduleChange: (
    year: number,
    locationId: string,
    day: Day,
    week: Week,
    vendorId: string | null,
  ) => Promise<void>
  onExclusionChange: (locationId: string, date: string, excluded: boolean) => Promise<void>
  /** Keys of the writes currently in flight; see the `*SaveKey` helpers above. */
  pendingKeys: ReadonlySet<string>
  readOnly: boolean
  onYearChange: (year: number) => void
  previousYearSlots: number
}

const LocationGrid: React.FC<LocationGridProps> = ({
  year,
  location,
  schedules,
  exclusions,
  onScheduleChange,
  onExclusionChange,
  pendingKeys,
  readOnly,
  onYearChange,
  previousYearSlots,
}) => {
  const locationSchedule = schedules[location.id] || {}

  // Days with no vendors all year (usually Sun/Mon) shrink so the busy days
  // get the width; the same pass answers whether week 5 is used anywhere.
  const { dayHasVendor, fifthWeekUsed } = useMemo(
    () => ({
      dayHasVendor: days.map((day) => weeks.some((week) => Boolean(locationSchedule[day]?.[week]))),
      fifthWeekUsed: days.some((day) => Boolean(locationSchedule[day]?.fifth)),
    }),
    [locationSchedule],
  )

  // Week 5 exists for at most a couple of month/day combos and is usually
  // empty, so hide its row unless it has data or the manager asks for it.
  const [showFifthWeek, setShowFifthWeek] = useState(false)
  const visibleWeeks = fifthWeekUsed || showFifthWeek ? weeks : weeks.slice(0, 4)

  const handleCellChange = useCallback(
    (day: Day, week: Week, vendorId: string | null) => {
      void onScheduleChange(year, location.id, day, week, vendorId)
    },
    [year, location.id, onScheduleChange],
  )

  return (
    <div>
      <div className="recurring-food-grid__table-wrap">
        <table className="recurring-food-grid__table">
          <thead>
            <tr>
              <th />
              {dayLabels.map((label, i) => (
                <th
                  key={days[i]}
                  className={dayHasVendor[i] ? undefined : 'recurring-food-grid__day--empty'}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleWeeks.map((week, weekIndex) => (
              <tr key={week}>
                <td>{weekIndex + 1}</td>
                {days.map((day) => {
                  const cellValue = locationSchedule[day]?.[week] || null
                  const cellKey = scheduleSaveKey(year, location.id, day, week)

                  return (
                    <td key={`${day}_${week}`}>
                      <GridCell
                        value={cellValue}
                        onChange={(vendorId) => handleCellChange(day, week, vendorId)}
                        cellKey={cellKey}
                        // Only this cell locks while its own save is in flight,
                        // so a run of quick edits queues instead of blocking.
                        readOnly={readOnly || pendingKeys.has(cellKey)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!fifthWeekUsed && !showFifthWeek && (
          <Button
            buttonStyle="none"
            className="recurring-food-grid__link-button"
            onClick={() => setShowFifthWeek(true)}
          >
            Show 5th week
          </Button>
        )}
      </div>
      <DatesList
        year={year}
        locationId={location.id}
        schedules={schedules}
        exclusions={exclusions}
        onExclusionChange={onExclusionChange}
        pendingKeys={pendingKeys}
        readOnly={readOnly}
        onYearChange={onYearChange}
        previousYearSlots={previousYearSlots}
      />
    </div>
  )
}

/**
 * RecurringFoodGrid - Location-agnostic recurring food schedule manager
 *
 * Event managers can read the grid (RecurringFood.access.read) but writes stay
 * food-manager/admin, so the cells lock for viewers instead of 403ing on save.
 */
export const RecurringFoodGrid: React.FC = () => {
  const { user } = useAuth<User>()
  const canEdit = isFoodManager(user)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [locations, setLocations] = useState<Location[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [schedules, setSchedules] = useState<SchedulesData>({})
  const [exclusions, setExclusions] = useState<ExclusionsData>({})
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(() => new Set())

  /**
   * Every write goes through one promise chain. Each cell edit is a
   * read/modify/write of shared state (the whole legacy global before the
   * migration, one schedule document after), so two overlapping saves can land
   * out of order and leave storage on the older value — or, pre-migration,
   * clobber an edit to a different cell entirely.
   *
   * Only the control whose own key is in flight is locked, not the whole grid:
   * a global lock would stop a second edit from ever being started, leaving the
   * queue permanently one-deep and forcing a server round trip between every
   * selection.
   */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  const enqueue = useCallback((key: string, task: () => Promise<void>): Promise<void> => {
    setPendingKeys((keys) => new Set(keys).add(key))
    const next = queueRef.current.then(task).finally(() =>
      setPendingKeys((keys) => {
        const remaining = new Set(keys)
        remaining.delete(key)
        return remaining
      }),
    )
    // Keep the chain alive after a rejection so later edits still run; the
    // returned promise keeps the rejection for the caller.
    queueRef.current = next.catch(() => {})
    return next
  }, [])

  // Locations don't vary by year, so fetch them once and let year changes and
  // save recovery refetch only the schedule data.
  const locationsLoadedRef = useRef(false)
  const refreshData = useCallback(async (year: number) => {
    const [nextLocations, recurringFood] = await Promise.all([
      locationsLoadedRef.current ? null : getActiveLocations(),
      getRecurringFoodData(year),
    ])
    if (nextLocations) {
      locationsLoadedRef.current = true
      setLocations(nextLocations)
      setActiveTab((current) =>
        nextLocations.some((location) => location.id === current)
          ? current
          : nextLocations[0]?.id || '',
      )
    }
    setSchedules(recurringFood.schedules as SchedulesData)
    setExclusions(recurringFood.exclusions)
  }, [])

  /**
   * When the selected year has no schedules, the empty state offers a jump to
   * the previous one. Owned here rather than in the leaf: `LocationGrid`
   * remounts on every tab switch, so a leaf-held fetch would repeat per tab.
   */
  // Tagged with the year it was fetched for, so switching years derives an
  // empty result instead of an effect clearing state up front — which is what
  // react-hooks/set-state-in-effect flags.
  const [previousYearFetch, setPreviousYearFetch] = useState<{
    year: number
    schedules: SchedulesData
  } | null>(null)
  const previousYearSchedules =
    previousYearFetch?.year === selectedYear - 1 ? previousYearFetch.schedules : EMPTY_SCHEDULES
  // Any empty location can show the hint, so one fetch covers every tab.
  const someLocationIsEmpty = locations.some((loc) => countSlots(schedules[loc.id]) === 0)
  useEffect(() => {
    if (!someLocationIsEmpty || selectedYear - 1 < RECURRING_YEAR_MIN) return

    let cancelled = false
    const year = selectedYear - 1
    getRecurringFoodData(year)
      .then((previous) => {
        if (!cancelled) {
          setPreviousYearFetch({ year, schedules: previous.schedules as SchedulesData })
        }
      })
      .catch((error) => logger.error('Error checking previous year schedules:', error))
    return () => {
      cancelled = true
    }
  }, [someLocationIsEmpty, selectedYear])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        await refreshData(selectedYear)
      } catch (error) {
        if (!cancelled) {
          logger.error('Error fetching recurring food data:', error)
          setSaveError('Could not load recurring food schedules. Please refresh and try again.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [refreshData, selectedYear])

  /**
   * Queue one optimistic write. Callers apply their change to local state
   * first; on failure this restores the server's version, reports it, and
   * rethrows so a caller that renders its own confirmation (the exclusion
   * modal) can stay open.
   */
  const save = useCallback(
    (key: string, label: 'schedule' | 'exclusion', task: () => Promise<void>): Promise<void> =>
      enqueue(key, async () => {
        try {
          await task()
        } catch (error) {
          logger.error(`Error saving recurring food ${label}:`, error)
          setSaveError(`That ${label} change was not saved. The grid has been restored.`)
          await refreshData(selectedYear)
          throw error
        }
      }),
    [enqueue, refreshData, selectedYear],
  )

  const handleScheduleChange = useCallback(
    async (year: number, locationId: string, day: Day, week: Week, vendorId: string | null) => {
      if (!canEdit) return
      setSaveError(null)
      setSchedules((current) => ({
        ...current,
        [locationId]: {
          ...(current[locationId] || {}),
          [day]: {
            ...(current[locationId]?.[day] || {}),
            [week]: vendorId,
          },
        },
      }))

      // Nothing to react to beyond the banner `save` already set.
      await save(scheduleSaveKey(year, locationId, day, week), 'schedule', () =>
        setRecurringFoodSchedule(year, locationId, day, week, vendorId),
      ).catch(() => {})
    },
    [canEdit, save],
  )

  const handleExclusionChange = useCallback(
    async (locationId: string, date: string, excluded: boolean) => {
      if (!canEdit) return
      setSaveError(null)
      setExclusions((current) => {
        const dates = new Set(current[locationId] || [])
        if (excluded) dates.add(date)
        else dates.delete(date)
        return { ...current, [locationId]: [...dates].sort() }
      })

      await save(exclusionSaveKey(locationId, date), 'exclusion', () =>
        setRecurringFoodExclusion(locationId, date, excluded),
      )
    },
    [canEdit, save],
  )

  const activeLocation = useMemo(() => {
    return locations.find((loc) => loc.id === activeTab)
  }, [locations, activeTab])

  if (loading) {
    return (
      <div className="recurring-food-grid__status" aria-label="Loading locations">
        <ShimmerEffect height="2rem" />
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="recurring-food-grid__status">
        No active locations found. Please add locations in the Locations collection.
      </div>
    )
  }

  return (
    <div>
      <Banner type="info">
        {canEdit
          ? 'Changes in this grid save immediately.'
          : 'View only — ask a food manager to change the schedule.'}
      </Banner>
      {saveError && <Banner type="error">{saveError}</Banner>}
      <div aria-label="Schedule year" className="recurring-food-grid__year-nav">
        <Button
          buttonStyle="secondary"
          size="small"
          onClick={() => setSelectedYear((year) => Math.max(RECURRING_YEAR_MIN, year - 1))}
          disabled={selectedYear <= RECURRING_YEAR_MIN}
        >
          Previous year
        </Button>
        <div className="recurring-food-grid__year-center">
          <div className="recurring-food-grid__year-label">Schedule year</div>
          <strong className="recurring-food-grid__year-value">{selectedYear}</strong>
        </div>
        <Button
          buttonStyle="secondary"
          size="small"
          onClick={() => setSelectedYear((year) => Math.min(RECURRING_YEAR_MAX, year + 1))}
          disabled={selectedYear >= RECURRING_YEAR_MAX}
        >
          Next year
        </Button>
      </div>
      {/* Tabs */}
      <div role="tablist" aria-label="Locations" className="recurring-food-grid__tabs">
        {locations.map((location) => (
          <button
            key={location.id}
            id={`recurring-food-tab-${location.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === location.id}
            aria-controls={`recurring-food-panel-${location.id}`}
            onClick={() => setActiveTab(location.id)}
            className={cn(
              'recurring-food-grid__tab',
              activeTab === location.id && 'recurring-food-grid__tab--active',
            )}
          >
            {location.name}
          </button>
        ))}
      </div>

      {/* Active location grid */}
      {activeLocation && (
        <div
          id={`recurring-food-panel-${activeLocation.id}`}
          role="tabpanel"
          aria-labelledby={`recurring-food-tab-${activeLocation.id}`}
        >
          <LocationGrid
            key={`${selectedYear}-${activeLocation.id}`} // remount so year/location state cannot leak
            year={selectedYear}
            location={activeLocation}
            schedules={schedules}
            exclusions={exclusions}
            onScheduleChange={handleScheduleChange}
            onExclusionChange={handleExclusionChange}
            pendingKeys={pendingKeys}
            readOnly={!canEdit}
            onYearChange={setSelectedYear}
            previousYearSlots={countSlots(previousYearSchedules[activeLocation.id])}
          />
        </div>
      )}
    </div>
  )
}

export default RecurringFoodGrid
