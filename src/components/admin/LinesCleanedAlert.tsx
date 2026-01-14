'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { Banner } from '@payloadcms/ui'

interface Location {
  id: string
  name: string
  linesLastCleaned?: string | null
}

type AlertLevel = 'warning' | 'error' | null

function getAlertLevel(dateStr: string | null | undefined): { level: AlertLevel; days: number; dueDate: string | null } {
  if (!dateStr) return { level: 'error', days: -1, dueDate: null }

  const lastCleaned = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - lastCleaned.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Calculate due date (15 days after last cleaned)
  const dueDateObj = new Date(lastCleaned)
  dueDateObj.setDate(dueDateObj.getDate() + 15)
  const dueDate = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (days >= 15) return { level: 'error', days, dueDate }
  if (days >= 7) return { level: 'warning', days, dueDate }
  return { level: null, days, dueDate }
}

export function LinesCleanedAlert({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<Array<{ location: Location; level: AlertLevel; days: number; dueDate: string | null }>>([])
  const [loading, setLoading] = useState(true)

  // Check if user has permission to see this alert
  const hasAccess = user?.roles?.includes('admin') || user?.roles?.includes('lead-bartender')

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false)
      return
    }

    async function fetchLocations() {
      try {
        const res = await fetch('/api/locations?limit=100&depth=0')
        const data = await res.json()

        const locationAlerts: Array<{ location: Location; level: AlertLevel; days: number; dueDate: string | null }> = []

        for (const location of data.docs || []) {
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
        console.error('Failed to fetch locations for lines cleaned alert:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLocations()

    // Listen for optimistic updates when lines are cleaned
    const handleLinesCleanedUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ locationId: string }>
      const locationId = customEvent.detail?.locationId

      if (locationId) {
        // Optimistically remove this location from alerts immediately
        setAlerts(prev => prev.filter(a => a.location.id !== locationId))
      }
    }

    window.addEventListener('linesCleanedUpdate', handleLinesCleanedUpdate)
    return () => window.removeEventListener('linesCleanedUpdate', handleLinesCleanedUpdate)
  }, [hasAccess])

  if (!hasAccess || loading || alerts.length === 0) {
    return <>{children}</>
  }

  const errorAlerts = alerts.filter(a => a.level === 'error')
  const warningAlerts = alerts.filter(a => a.level === 'warning')

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
            ))}
            {' '}- Draft lines need cleaning immediately!
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
