'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { Banner } from '@payloadcms/ui'
import { logger } from '@/lib/utils/logger'
import { hasRole } from '@/src/access/roles'
import { getAdminRelationshipID } from '@/src/components/admin/relationship-value'
import {
  daysSinceCleaned,
  LINES_OVERDUE_DAYS,
  LINES_WARN_DAYS,
} from '@/lib/utils/lines-cleaned'
import type { User } from '@/src/payload-types'

interface Location {
  id: string
  name: string
  linesLastCleaned?: string | null
}

type AlertLevel = 'warning' | 'error' | null

function getAlertLevel(dateStr: string | null | undefined): {
  level: AlertLevel
  days: number
  dueDate: string | null
} {
  const days = daysSinceCleaned(dateStr)
  if (!dateStr || days === null) return { level: 'error', days: -1, dueDate: null }

  // Calculate due date (LINES_OVERDUE_DAYS after last cleaned)
  const dueDateObj = new Date(dateStr)
  dueDateObj.setDate(dueDateObj.getDate() + LINES_OVERDUE_DAYS)
  const dueDate = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (days >= LINES_OVERDUE_DAYS) return { level: 'error', days, dueDate }
  if (days >= LINES_WARN_DAYS) return { level: 'warning', days, dueDate }
  return { level: null, days, dueDate }
}

export function LinesCleanedAlert({ children }: { children: React.ReactNode }) {
  const { user } = useAuth<User>()
  const [alerts, setAlerts] = useState<
    Array<{ location: Location; level: AlertLevel; days: number; dueDate: string | null }>
  >([])
  const [loading, setLoading] = useState(true)

  const isAdmin = hasRole(user, 'admin')
  const isLeadBartender = hasRole(user, 'lead-bartender')
  const assignedLocationIds = useMemo(
    () =>
      new Set(
        (user?.locations || [])
          .map((location) => getAdminRelationshipID(location))
          .filter((id): id is string => id !== null),
      ),
    [user?.locations],
  )
  const hasAccess = isAdmin || (isLeadBartender && assignedLocationIds.size > 0)

  useEffect(() => {
    // Without access the component renders null regardless of `loading`, so
    // clearing the flag here would only be a setState in an effect body.
    if (!hasAccess) return

    async function fetchLocations() {
      try {
        const res = await fetch('/api/locations?limit=100&depth=0')
        if (!res.ok) throw new Error(`Location request failed (${res.status})`)

        const data = (await res.json()) as { docs?: Location[] }

        const locationAlerts: Array<{
          location: Location
          level: AlertLevel
          days: number
          dueDate: string | null
        }> = []

        for (const location of data.docs || []) {
          if (!isAdmin && !assignedLocationIds.has(location.id)) continue

          const { level, days, dueDate } = getAlertLevel(location.linesLastCleaned)
          if (level) {
            locationAlerts.push({ location, level, days, dueDate })
          }
        }

        // Sort by severity (error first) then by days
        locationAlerts.sort((a, b) => {
          if (a.level === 'error' && b.level !== 'error') return -1
          if (a.level !== 'error' && b.level === 'error') return 1
          return b.days - a.days
        })

        setAlerts(locationAlerts)
      } catch (error) {
        logger.error('Failed to fetch locations for lines cleaned alert:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLocations()

    // The button emits this event only after Payload confirms the update.
    const handleLinesCleanedUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ locationId: string }>
      const locationId = customEvent.detail?.locationId

      if (locationId) {
        setAlerts((prev) => prev.filter((a) => a.location.id !== locationId))
      }
    }

    window.addEventListener('linesCleanedUpdate', handleLinesCleanedUpdate)
    return () => window.removeEventListener('linesCleanedUpdate', handleLinesCleanedUpdate)
  }, [assignedLocationIds, hasAccess, isAdmin])

  if (!hasAccess || loading || alerts.length === 0) {
    return <>{children}</>
  }

  const errorAlerts = alerts.filter((a) => a.level === 'error')
  const warningAlerts = alerts.filter((a) => a.level === 'warning')

  return (
    <>
      <style>{`
        .lines-cleaned-alerts > div:not(:last-child) {
          margin-bottom: 0 !important;
        }
      `}</style>
      <div className="lines-cleaned-alerts">
        {errorAlerts.length > 0 && (
          <Banner type="error">
            <strong>OVERDUE:</strong>{' '}
            {errorAlerts.map((a, i) => (
              <span key={a.location.id}>
                {a.location.name} ({a.days === -1 ? 'never cleaned' : `${a.days} days`})
                {i < errorAlerts.length - 1 ? ', ' : ''}
              </span>
            ))}{' '}
            - Draft lines need cleaning immediately!
          </Banner>
        )}
        {warningAlerts.map((a) => (
          <Banner key={a.location.id} type="info">
            <strong>Clean Draft Lines ({a.location.name}):</strong> By {a.dueDate}
          </Banner>
        ))}
      </div>
      {children}
    </>
  )
}
