'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Banner, ConfirmationModal, RelationshipInput, useModal } from '@payloadcms/ui'
import type { ValueWithRelation } from 'payload'
import {
  getActiveLocations,
  getFoodVendorsByIds,
  getRecurringFoodData,
  getUpcomingFoodForLocation,
  setRecurringFoodExclusion,
  setRecurringFoodSchedule,
  type SimpleLocation,
} from '@/src/actions/admin-data'
import { logger } from '@/lib/utils/logger'

const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fullDayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const weeks = ['first', 'second', 'third', 'fourth', 'fifth'] as const
const weekLabels = ['1', '2', '3', '4', '5']
const weekOrdinals = ['1st', '2nd', '3rd', '4th', '5th']

type Day = (typeof days)[number]
type Week = (typeof weeks)[number]

// Schedule data structure: { [day]: { [week]: vendorId } }
type LocationSchedule = Partial<Record<Day, Partial<Record<Week, string | null>>>>

// Full schedules structure: { [locationId]: LocationSchedule }
type SchedulesData = Record<string, LocationSchedule>

// Exclusions structure: { [locationId]: string[] }
type ExclusionsData = Record<string, string[]>

// Using SimpleLocation from server actions
type Location = SimpleLocation

// Get all occurrences of a specific week/day combo for the next N months
function getUpcomingDates(
  dayIndex: number,
  weekOccurrence: number,
  monthsAhead: number = 6,
): Date[] {
  const dates: Date[] = []
  const today = new Date()
  const startMonth = today.getMonth()
  const startYear = today.getFullYear()

  for (let i = 0; i < monthsAhead; i++) {
    const month = (startMonth + i) % 12
    const year = startYear + Math.floor((startMonth + i) / 12)

    const firstOfMonth = new Date(year, month, 1)
    const firstDayOfMonth = firstOfMonth.getDay()

    let firstOccurrence = dayIndex - firstDayOfMonth + 1
    if (firstOccurrence <= 0) firstOccurrence += 7

    const targetDay = firstOccurrence + (weekOccurrence - 1) * 7
    const targetDate = new Date(year, month, targetDay)

    if (targetDate.getMonth() === month && targetDate >= today) {
      dates.push(targetDate)
    }
  }

  return dates
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
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
      allowCreate={true}
      allowEdit={true}
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
  locationId: string
  schedules: SchedulesData
  exclusions: ExclusionsData
  onExclusionChange: (locationId: string, date: string, excluded: boolean) => Promise<void>
  saving: boolean
}

const EXCLUSION_MODAL_SLUG = 'confirm-exclusion'

const DatesList: React.FC<DatesListProps> = ({
  locationId,
  schedules,
  exclusions,
  onExclusionChange,
  saving,
}) => {
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({})
  const [individualFoodEvents, setIndividualFoodEvents] = useState<ScheduledDate[]>([])
  const [pendingToggle, setPendingToggle] = useState<{
    date: Date
    vendorName: string
    isExcluded: boolean
  } | null>(null)
  const { openModal, closeModal } = useModal()

  const locationExclusions = useMemo(() => exclusions[locationId] || [], [exclusions, locationId])
  const locationSchedule = useMemo(() => schedules[locationId] || {}, [schedules, locationId])

  const recurringDates = useMemo(() => {
    const dates: ScheduledDate[] = []

    days.forEach((day, dayIndex) => {
      weeks.forEach((week, weekIndex) => {
        const vendorId = locationSchedule[day]?.[week]

        if (vendorId) {
          const upcomingDates = getUpcomingDates(dayIndex, weekIndex + 1, 12)
          upcomingDates.forEach((date) => {
            dates.push({ date, dayIndex, weekIndex, vendorId, type: 'recurring' })
          })
        }
      })
    })

    return dates
  }, [locationSchedule])

  // Fetch individual food events using server action (local API)
  useEffect(() => {
    const fetchIndividualEvents = async () => {
      try {
        const foodEvents = await getUpcomingFoodForLocation(locationId)

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
        logger.error('Error fetching individual food events:', error)
      }
    }

    if (locationId) {
      fetchIndividualEvents()
    }
  }, [locationId])

  const scheduledDates = useMemo(() => {
    const allDates = [...recurringDates, ...individualFoodEvents]
    allDates.sort((a, b) => a.date.getTime() - b.date.getTime())
    return allDates
  }, [recurringDates, individualFoodEvents])

  // Fetch vendor names for recurring events
  useEffect(() => {
    const vendorIds = [...new Set(recurringDates.map((d) => d.vendorId))]
    if (vendorIds.length === 0) return

    const fetchVendors = async () => {
      try {
        const names = await getFoodVendorsByIds(vendorIds)
        setVendorNames(names)
      } catch (error) {
        logger.error('Error fetching vendor names:', error)
      }
    }

    fetchVendors()
  }, [recurringDates])

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
    if (!pendingToggle) return

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

    Object.entries(dateMap).forEach(([, items]) => {
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

  if (scheduledDates.length === 0) {
    return (
      <div style={{ padding: '20px 0', color: 'var(--theme-elevation-500)', fontSize: '14px' }}>
        No vendors scheduled. Select vendors in the grid above to see upcoming dates.
      </div>
    )
  }

  return (
    <div
      style={{
        marginTop: '24px',
        paddingTop: '16px',
        borderTop: '1px solid var(--theme-elevation-150)',
      }}
    >
      <ConfirmationModal
        modalSlug={EXCLUSION_MODAL_SLUG}
        heading={pendingToggle?.isExcluded ? 'Remove Exclusion' : 'Exclude Event'}
        body={
          pendingToggle?.isExcluded
            ? `Are you sure you want to restore "${pendingToggle?.vendorName}" on ${pendingToggle ? formatDate(pendingToggle.date) : ''}?`
            : `Are you sure you want to exclude "${pendingToggle?.vendorName}" on ${pendingToggle ? formatDate(pendingToggle.date) : ''}?`
        }
        confirmLabel={pendingToggle?.isExcluded ? 'Restore' : 'Exclude'}
        onConfirm={confirmToggleExclusion}
        onCancel={cancelToggleExclusion}
      />
      {conflicts.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--theme-warning-100)',
            border: '1px solid var(--theme-warning-500)',
            borderRadius: '4px',
            marginBottom: '16px',
          }}
        >
          <strong style={{ color: 'var(--theme-warning-700)' }}>Conflicts:</strong>
          <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--theme-warning-800)' }}>
            {conflicts.map((c, i) => (
              <div key={i} style={{ marginBottom: '4px' }}>
                <strong>{formatDate(c.date)}</strong>: {c.recurringVendor} (recurring) +{' '}
                {c.individualVendor} (scheduled)
              </div>
            ))}
          </div>
        </div>
      )}
      <h4
        style={{
          margin: '0 0 8px 0',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--theme-elevation-800)',
        }}
      >
        Upcoming Dates
        <span
          style={{
            fontWeight: 400,
            fontSize: '12px',
            color: 'var(--theme-elevation-400)',
            marginLeft: '8px',
          }}
        >
          (click to exclude)
        </span>
      </h4>
      <div style={{ fontSize: '13px', color: 'var(--theme-elevation-600)' }}>
        {Object.entries(groupedByMonth).map(([month, dates]) => (
          <div key={month} style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: '12px',
                color: 'var(--theme-elevation-500)',
                marginBottom: '4px',
              }}
            >
              {month}
            </div>
            {dates.map((item, idx) => {
              const excluded = item.type === 'recurring' && isExcluded(item.date)
              const isIndividual = item.type === 'individual'
              const isDisabled = isIndividual || saving
              const displayName = item.vendorName || vendorNames[item.vendorId] || '...'
              let backgroundColor = 'transparent'
              if (excluded) backgroundColor = 'var(--theme-error-50)'
              else if (isIndividual) backgroundColor = 'var(--theme-elevation-100)'

              let ariaLabel: string | undefined
              if (!isIndividual) {
                const action = excluded ? 'Restore' : 'Exclude'
                ariaLabel = `${action} ${displayName} on ${formatDate(item.date)}`
              }

              return (
                <button
                  key={`${item.date.toISOString()}-${idx}-${item.type}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => requestToggleExclusion(item.date, displayName)}
                  aria-label={ariaLabel}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '4px 8px',
                    margin: '2px 0',
                    cursor: isDisabled ? 'default' : 'pointer',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    backgroundColor,
                    opacity: excluded ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ textDecoration: excluded ? 'line-through' : 'none' }}>
                    <strong>{formatDate(item.date)}</strong> {displayName}
                  </span>{' '}
                  {isIndividual ? (
                    <span
                      style={{
                        backgroundColor: 'var(--theme-success-500)',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '10px',
                        marginLeft: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Scheduled
                    </span>
                  ) : (
                    <span style={{ color: 'var(--theme-elevation-400)' }}>
                      ({weekOrdinals[item.weekIndex]} {fullDayLabels[item.dayIndex]})
                    </span>
                  )}
                  {excluded && (
                    <span
                      style={{
                        backgroundColor: 'var(--theme-error-500)',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '10px',
                        marginLeft: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Excluded
                    </span>
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
  location: Location
  schedules: SchedulesData
  exclusions: ExclusionsData
  onScheduleChange: (
    locationId: string,
    day: Day,
    week: Week,
    vendorId: string | null,
  ) => Promise<void>
  onExclusionChange: (locationId: string, date: string, excluded: boolean) => Promise<void>
  saving: boolean
}

const LocationGrid: React.FC<LocationGridProps> = ({
  location,
  schedules,
  exclusions,
  onScheduleChange,
  onExclusionChange,
  saving,
}) => {
  const locationSchedule = schedules[location.id] || {}

  const handleCellChange = useCallback(
    (day: Day, week: Week, vendorId: string | null) => {
      void onScheduleChange(location.id, day, week, vendorId)
    },
    [location.id, onScheduleChange],
  )

  return (
    <div>
      <style>{`
        .rs__menu {
          z-index: 10000 !important;
          min-width: 220px !important;
        }
        .rs__menu-list {
          max-height: 300px !important;
        }
        .rs__option {
          white-space: normal !important;
          word-break: break-word !important;
        }
        .rs__single-value {
          overflow: visible !important;
          white-space: normal !important;
          text-overflow: clip !important;
        }
        .rs__value-container {
          flex-wrap: wrap !important;
        }
      `}</style>
      <div style={{ padding: '10px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  padding: '10px',
                  textAlign: 'center',
                  fontWeight: 600,
                  width: '60px',
                }}
              />
              {dayLabels.map((label, i) => (
                <th
                  key={days[i]}
                  style={{
                    padding: '10px',
                    textAlign: 'center',
                    fontWeight: 600,
                    minWidth: '180px',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={week}>
                <td
                  style={{
                    padding: '10px',
                    textAlign: 'center',
                    fontWeight: 500,
                  }}
                >
                  {weekLabels[weekIndex]}
                </td>
                {days.map((day) => {
                  const cellValue = locationSchedule[day]?.[week] || null

                  return (
                    <td
                      key={`${day}_${week}`}
                      style={{
                        padding: '4px',
                      }}
                    >
                      <GridCell
                        value={cellValue}
                        onChange={(vendorId) => handleCellChange(day, week, vendorId)}
                        cellKey={`${location.id}-${day}-${week}`}
                        readOnly={saving}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DatesList
        locationId={location.id}
        schedules={schedules}
        exclusions={exclusions}
        onExclusionChange={onExclusionChange}
        saving={saving}
      />
    </div>
  )
}

/**
 * RecurringFoodGrid - Location-agnostic recurring food schedule manager
 *
 * Fetches locations dynamically and renders tabs for each. Edits save
 * immediately through authenticated actions backed by normalized collections.
 */
export const RecurringFoodGrid: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [schedules, setSchedules] = useState<SchedulesData>({})
  const [exclusions, setExclusions] = useState<ExclusionsData>({})
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingSaves, setPendingSaves] = useState(0)

  /**
   * Every write goes through one promise chain, and the controls are locked
   * while it drains. Each cell edit is a read/modify/write of shared state (the
   * whole legacy global before the migration, one schedule document after), so
   * two overlapping saves can land out of order and leave storage on the older
   * value — or, pre-migration, clobber an edit to a different cell entirely.
   */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  const enqueue = useCallback((task: () => Promise<void>): Promise<void> => {
    setPendingSaves((count) => count + 1)
    const next = queueRef.current.then(task).finally(() => setPendingSaves((count) => count - 1))
    // Keep the chain alive after a rejection so later edits still run; the
    // returned promise keeps the rejection for the caller.
    queueRef.current = next.catch(() => {})
    return next
  }, [])

  const refreshData = useCallback(async () => {
    const [nextLocations, recurringFood] = await Promise.all([
      getActiveLocations(),
      getRecurringFoodData(),
    ])
    setLocations(nextLocations)
    setSchedules(recurringFood.schedules as SchedulesData)
    setExclusions(recurringFood.exclusions)
    setActiveTab((current) =>
      nextLocations.some((location) => location.id === current)
        ? current
        : nextLocations[0]?.id || '',
    )
  }, [])

  useEffect(() => {
    async function load() {
      try {
        await refreshData()
      } catch (error) {
        logger.error('Error fetching recurring food data:', error)
        setSaveError('Could not load recurring food schedules. Please refresh and try again.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [refreshData])

  const handleScheduleChange = useCallback(
    async (locationId: string, day: Day, week: Week, vendorId: string | null) => {
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

      await enqueue(async () => {
        try {
          await setRecurringFoodSchedule(locationId, day, week, vendorId)
        } catch (error) {
          logger.error('Error saving recurring food schedule:', error)
          setSaveError('That schedule change was not saved. The grid has been restored.')
          await refreshData()
        }
      })
    },
    [enqueue, refreshData],
  )

  const handleExclusionChange = useCallback(
    async (locationId: string, date: string, excluded: boolean) => {
      setSaveError(null)
      setExclusions((current) => {
        const dates = new Set(current[locationId] || [])
        if (excluded) dates.add(date)
        else dates.delete(date)
        return { ...current, [locationId]: [...dates].sort() }
      })

      await enqueue(async () => {
        try {
          await setRecurringFoodExclusion(locationId, date, excluded)
        } catch (error) {
          logger.error('Error saving recurring food exclusion:', error)
          setSaveError('That exclusion change was not saved. The grid has been restored.')
          await refreshData()
          throw error
        }
      })
    },
    [enqueue, refreshData],
  )

  const activeLocation = useMemo(() => {
    return locations.find((loc) => loc.id === activeTab)
  }, [locations, activeTab])

  if (loading) {
    return (
      <div style={{ padding: '20px', color: 'var(--theme-elevation-500)' }}>
        Loading locations...
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div style={{ padding: '20px', color: 'var(--theme-elevation-500)' }}>
        No active locations found. Please add locations in the Locations collection.
      </div>
    )
  }

  return (
    <div>
      <Banner type="info">Changes in this grid save immediately.</Banner>
      {saveError && <Banner type="error">{saveError}</Banner>}
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Locations"
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--theme-elevation-150)',
          marginBottom: '16px',
        }}
      >
        {locations.map((location) => (
          <button
            key={location.id}
            id={`recurring-food-tab-${location.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === location.id}
            aria-controls={`recurring-food-panel-${location.id}`}
            onClick={() => setActiveTab(location.id)}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: activeTab === location.id ? 600 : 400,
              color: activeTab === location.id ? 'var(--theme-text)' : 'var(--theme-elevation-500)',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === location.id
                  ? '2px solid var(--theme-elevation-800)'
                  : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
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
            location={activeLocation}
            schedules={schedules}
            exclusions={exclusions}
            onScheduleChange={handleScheduleChange}
            onExclusionChange={handleExclusionChange}
            saving={pendingSaves > 0}
          />
        </div>
      )}
    </div>
  )
}

export default RecurringFoodGrid
