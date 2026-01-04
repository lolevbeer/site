'use client'

import React, { useState, useRef } from 'react'
import { Gutter } from '@payloadcms/ui'
import { format } from 'date-fns-tz'

interface FieldChange {
  field: string
  from: any
  to: any
}

interface MenuChanges {
  added: number
  removed: number
  priceChanges: number
}

interface LogEntry {
  id: number
  type: 'status' | 'event' | 'food' | 'beer' | 'menu' | 'hours' | 'error' | 'complete'
  message: string
  timestamp: Date
  changes?: FieldChange[] | MenuChanges
}

type CollectionType = 'events' | 'food' | 'beers' | 'menus' | 'hours' | 'recalc'

interface SyncResults {
  events?: { imported: number; updated: number; skipped: number; errors: number }
  food?: { imported: number; updated: number; skipped: number; errors: number }
  beers?: { imported: number; updated: number; skipped: number; errors: number }
  menus?: { imported: number; updated: number; skipped: number; errors: number }
  hours?: { imported: number; updated: number; skipped: number; errors: number }
  recalc?: { updated: number; skipped: number; errors: number }
  dryRun?: boolean
}

interface CSVImportResults {
  success: boolean
  total: number
  created: number
  skipped: number
  errors: number
  details: string[]
}

interface DistributorImportResult {
  region: string
  imported: number
  skipped: number
  errors: number
  details: string[]
}

export const SyncViewClient: React.FC = () => {
  const [syncing, setSyncing] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [selectedCollections, setSelectedCollections] = useState<CollectionType[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [results, setResults] = useState<SyncResults | null>(null)
  const logIdRef = useRef(0)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // CSV Import state
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResults, setCsvResults] = useState<CSVImportResults | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  // Distributor import state
  const [paUrl, setPaUrl] = useState('')
  const [ohUrl, setOhUrl] = useState('')
  const [urlsLoading, setUrlsLoading] = useState(true)
  const [urlsSaving, setUrlsSaving] = useState(false)
  const [urlsSaveStatus, setUrlsSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [distImporting, setDistImporting] = useState<'pa' | 'oh' | null>(null)
  const [distResults, setDistResults] = useState<DistributorImportResult | null>(null)
  const [distProgress, setDistProgress] = useState<{ current: number; total: number; name: string; percent: number } | null>(null)
  const [distLiveDetails, setDistLiveDetails] = useState<string[]>([])

  // Lake Beverage CSV import state
  const [lakeUploading, setLakeUploading] = useState(false)
  const [lakeResults, setLakeResults] = useState<DistributorImportResult | null>(null)
  const [lakeProgress, setLakeProgress] = useState<{ current: number; total: number; name: string; percent: number } | null>(null)
  const lakeInputRef = useRef<HTMLInputElement>(null)

  // Recalculate beer fields state
  const [recalcRunning, setRecalcRunning] = useState(false)
  const [recalcDryRun, setRecalcDryRun] = useState(true)
  const [recalcResults, setRecalcResults] = useState<{ updated: number; skipped: number; errors: number } | null>(null)
  const [recalcLogs, setRecalcLogs] = useState<string[]>([])

  // Load distributor URLs on mount
  React.useEffect(() => {
    fetch('/api/globals/site-content/')
      .then(res => res.json())
      .then(data => {
        setPaUrl(data.distributorPaUrl || '')
        setOhUrl(data.distributorOhUrl || '')
      })
      .catch(() => {})
      .finally(() => setUrlsLoading(false))
  }, [])

  const addLog = (type: LogEntry['type'], message: string, changes?: LogEntry['changes']) => {
    setLogs(prev => [...prev, { id: logIdRef.current++, type, message, timestamp: new Date(), changes }])
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const toggleCollection = (collection: CollectionType) => {
    setSelectedCollections(prev =>
      prev.includes(collection)
        ? prev.filter(c => c !== collection)
        : [...prev, collection]
    )
  }

  const handleSync = async () => {
    if (selectedCollections.length === 0) {
      addLog('error', 'Please select at least one collection to sync')
      return
    }

    setSyncing(true)
    setLogs([])
    setResults(null)
    logIdRef.current = 0

    try {
      const params = new URLSearchParams()
      if (dryRun) params.set('dryRun', 'true')
      params.set('collections', selectedCollections.join(','))

      const response = await fetch(`/api/sync-google-sheets?${params.toString()}`, {
        method: 'POST',
        credentials: 'same-origin',
      })

      if (!response.ok) {
        addLog('error', `HTTP error: ${response.status}`)
        setSyncing(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        addLog('error', 'No response body')
        setSyncing(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)

            if (currentEvent && currentData) {
              try {
                const data = JSON.parse(currentData)

                switch (currentEvent) {
                  case 'status':
                    addLog('status', data.message)
                    break
                  case 'event':
                    addLog('event', `Event: ${data.organizer} (${data.date}) - ${data.location}`, data.changes)
                    break
                  case 'food':
                    addLog('food', `Food: ${data.vendor} (${data.date}) - ${data.location}`, data.changes)
                    break
                  case 'beer':
                    addLog('beer', `Beer: ${data.name} (${data.style})`, data.changes)
                    break
                  case 'menu':
                    addLog('menu', `Menu: ${data.location} ${data.type} - ${data.itemCount} items`, data.changes)
                    break
                  case 'hours':
                    addLog('hours', `Hours: ${data.location} - ${data.action}`, data.changes)
                    break
                  case 'error':
                    addLog('error', data.message)
                    break
                  case 'complete':
                    if (data.success) {
                      setResults({ ...data.results, dryRun: data.dryRun })
                      addLog('complete', data.dryRun ? 'Preview complete!' : 'Sync complete!')
                    } else {
                      addLog('error', `Sync failed: ${data.error}`)
                    }
                    break
                }
              } catch {
                // Ignore parse errors
              }

              currentEvent = ''
              currentData = ''
            }
          }
        }
      }
    } catch (error: any) {
      addLog('error', `Connection error: ${error.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const getLogClasses = (type: LogEntry['type']) => {
    switch (type) {
      case 'status': return 'color: var(--theme-elevation-500)'
      case 'event': return 'color: #60a5fa'
      case 'food': return 'color: #c084fc'
      case 'beer': return 'color: #fbbf24'
      case 'menu': return 'color: #34d399'
      case 'hours': return 'color: #f472b6'
      case 'error': return 'color: #f87171'
      case 'complete': return 'color: #4ade80'
      default: return 'color: var(--theme-elevation-400)'
    }
  }

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'event': return '✓'
      case 'food': return '✓'
      case 'beer': return '✓'
      case 'menu': return '✓'
      case 'hours': return '✓'
      case 'error': return '✗'
      case 'complete': return '●'
      default: return '→'
    }
  }

  const saveDistributorUrls = async () => {
    setUrlsSaving(true)
    setUrlsSaveStatus('idle')
    try {
      const response = await fetch('/api/update-distributor-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ distributorPaUrl: paUrl, distributorOhUrl: ohUrl }),
      })

      if (!response.ok) {
        const data = await response.json()
        console.error('Failed to save URLs:', response.status, data.error)
        setUrlsSaveStatus('error')
      } else {
        setUrlsSaveStatus('success')
        setTimeout(() => setUrlsSaveStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Failed to save URLs:', error)
      setUrlsSaveStatus('error')
    } finally {
      setUrlsSaving(false)
    }
  }

  const importDistributors = async (region: 'pa' | 'oh') => {
    const url = region === 'pa' ? paUrl : ohUrl
    if (!url) {
      setDistResults({
        region: region.toUpperCase(),
        imported: 0,
        skipped: 0,
        errors: 1,
        details: [`No URL configured for ${region.toUpperCase()}`],
      })
      return
    }

    setDistImporting(region)
    setDistResults(null)
    setDistProgress(null)
    setDistLiveDetails([])

    try {
      const response = await fetch(`/api/import-distributors?region=${region}`, {
        method: 'POST',
        credentials: 'same-origin',
      })

      // Check if it's a JSON error response (non-streaming)
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await response.json()
        const details: string[] = []
        if (data.error) details.push(`Error: ${data.error}`)
        if (data.details) details.push(...data.details)
        setDistResults({
          region: region.toUpperCase(),
          imported: data.imported || 0,
          skipped: data.skipped || 0,
          errors: data.errors || 1,
          details,
        })
        setDistImporting(null)
        return
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        setDistResults({
          region: region.toUpperCase(),
          imported: 0,
          skipped: 0,
          errors: 1,
          details: ['No response body'],
        })
        setDistImporting(null)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)

            if (currentEvent && currentData) {
              try {
                const data = JSON.parse(currentData)

                if (currentEvent === 'progress') {
                  setDistProgress(data)
                } else if (currentEvent === 'item') {
                  setDistLiveDetails(prev => [...prev.slice(-49), data.message]) // Keep last 50
                } else if (currentEvent === 'complete') {
                  setDistResults({
                    region: region.toUpperCase(),
                    imported: data.imported || 0,
                    skipped: data.skipped || 0,
                    errors: data.errors || 0,
                    details: data.details || [],
                  })
                  setDistProgress(null)
                }
              } catch {
                // Ignore parse errors
              }
              currentEvent = ''
              currentData = ''
            }
          }
        }
      }
    } catch (error: any) {
      setDistResults({
        region: region.toUpperCase(),
        imported: 0,
        skipped: 0,
        errors: 1,
        details: [`Network error: ${error.message || 'Import failed'}`],
      })
    } finally {
      setDistImporting(null)
      setDistProgress(null)
    }
  }

  const handleLakeBeverageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLakeUploading(true)
    setLakeResults(null)
    setLakeProgress(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/import-lake-beverage-csv', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        setLakeResults({
          region: 'NY',
          imported: 0,
          skipped: 0,
          errors: 1,
          details: [data.error || 'Upload failed'],
        })
        setLakeUploading(false)
        return
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        setLakeResults({
          region: 'NY',
          imported: 0,
          skipped: 0,
          errors: 1,
          details: ['No response body'],
        })
        setLakeUploading(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)

            if (currentEvent && currentData) {
              try {
                const data = JSON.parse(currentData)

                if (currentEvent === 'progress') {
                  setLakeProgress(data)
                } else if (currentEvent === 'complete') {
                  setLakeResults({
                    region: 'NY',
                    imported: data.imported || 0,
                    skipped: data.skipped || 0,
                    errors: data.errors || 0,
                    details: data.details || [],
                  })
                  setLakeProgress(null)
                }
              } catch {
                // Ignore parse errors
              }
              currentEvent = ''
              currentData = ''
            }
          }
        }
      }
    } catch (error: any) {
      setLakeResults({
        region: 'NY',
        imported: 0,
        skipped: 0,
        errors: 1,
        details: [error.message || 'Upload failed'],
      })
    } finally {
      setLakeUploading(false)
      setLakeProgress(null)
      if (lakeInputRef.current) {
        lakeInputRef.current.value = ''
      }
    }
  }

  const handleRecalculateBeerFields = async () => {
    setRecalcRunning(true)
    setRecalcResults(null)
    setRecalcLogs([])

    try {
      const params = new URLSearchParams()
      if (recalcDryRun) params.set('dryRun', 'true')
      params.set('collections', 'recalc')

      const response = await fetch(`/api/sync-google-sheets?${params.toString()}`, {
        method: 'POST',
        credentials: 'same-origin',
      })

      if (!response.ok) {
        setRecalcLogs(prev => [...prev, `Error: HTTP ${response.status}`])
        setRecalcRunning(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setRecalcLogs(prev => [...prev, 'Error: No response body'])
        setRecalcRunning(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)

            if (currentEvent && currentData) {
              try {
                const data = JSON.parse(currentData)

                if (currentEvent === 'status') {
                  setRecalcLogs(prev => [...prev.slice(-99), data.message])
                } else if (currentEvent === 'error') {
                  setRecalcLogs(prev => [...prev.slice(-99), `Error: ${data.message}`])
                } else if (currentEvent === 'complete') {
                  if (data.results?.recalc) {
                    setRecalcResults(data.results.recalc)
                  }
                }
              } catch {
                // Ignore parse errors
              }
              currentEvent = ''
              currentData = ''
            }
          }
        }
      }
    } catch (error: any) {
      setRecalcLogs(prev => [...prev, `Error: ${error.message || 'Recalculation failed'}`])
    } finally {
      setRecalcRunning(false)
    }
  }

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvUploading(true)
    setCsvResults(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/import-food-vendors-csv', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setCsvResults(data)
      } else {
        setCsvResults({
          success: false,
          total: 0,
          created: 0,
          skipped: 0,
          errors: 1,
          details: [data.error || 'Upload failed'],
        })
      }
    } catch (error: any) {
      setCsvResults({
        success: false,
        total: 0,
        created: 0,
        skipped: 0,
        errors: 1,
        details: [error.message || 'Upload failed'],
      })
    } finally {
      setCsvUploading(false)
      if (csvInputRef.current) {
        csvInputRef.current.value = ''
      }
    }
  }

  // Only include collections that sync from Google Sheets (not recalc)
  const collectionLabels: Record<Exclude<CollectionType, 'recalc'>, string> = {
    events: 'Events',
    food: 'Food',
    beers: 'Beers',
    menus: 'Menus',
    hours: 'Hours',
  }

  const collectionColors: Record<Exclude<CollectionType, 'recalc'>, string> = {
    events: '#60a5fa',
    food: '#c084fc',
    beers: '#fbbf24',
    menus: '#34d399',
    hours: '#f472b6',
  }

  return (
    <Gutter>
      <div style={{ maxWidth: '900px', paddingTop: '24px', paddingBottom: '48px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '8px',
            color: 'var(--theme-text)'
          }}>
            Sync from Google Sheets
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'var(--theme-elevation-600)',
            marginBottom: '16px'
          }}>
            Import data from Google Sheets. Matching entries will be updated.
          </p>

          {/* Collection Selection */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '16px',
          }}>
            {(Object.keys(collectionLabels) as Array<Exclude<CollectionType, 'recalc'>>).map(collection => (
              <button
                key={collection}
                onClick={() => toggleCollection(collection)}
                disabled={syncing}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: selectedCollections.includes(collection)
                    ? `2px solid ${collectionColors[collection]}`
                    : '2px solid var(--theme-elevation-200)',
                  backgroundColor: selectedCollections.includes(collection)
                    ? `${collectionColors[collection]}20`
                    : 'transparent',
                  color: selectedCollections.includes(collection)
                    ? collectionColors[collection]
                    : 'var(--theme-elevation-500)',
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  opacity: syncing ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {collectionLabels[collection]}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={handleSync}
              disabled={syncing || selectedCollections.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '4px',
                border: 'none',
                cursor: syncing || selectedCollections.length === 0 ? 'not-allowed' : 'pointer',
                opacity: syncing || selectedCollections.length === 0 ? 0.6 : 1,
                backgroundColor: dryRun ? 'var(--theme-elevation-500)' : 'var(--theme-success-500)',
                color: 'white',
                transition: 'all 0.15s',
              }}
            >
              {syncing && (
                <svg
                  style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }}
                  viewBox="0 0 24 24"
                >
                  <circle
                    style={{ opacity: 0.25 }}
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    style={{ opacity: 0.75 }}
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {syncing ? (dryRun ? 'Previewing...' : 'Syncing...') : (dryRun ? 'Preview' : 'Sync Now')}
            </button>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: 'var(--theme-text)',
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                disabled={syncing}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Dry run (preview only)
            </label>
          </div>
        </div>

        {/* Log Console */}
        {logs.length > 0 && (
          <div style={{
            marginBottom: '24px',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--theme-elevation-150)',
            backgroundColor: '#0d1117',
          }}>
            <div style={{
              padding: '8px 16px',
              borderBottom: '1px solid #30363d',
              backgroundColor: '#161b22',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#8b949e' }}>
                Console Output
              </span>
            </div>
            <div style={{
              height: '320px',
              overflowY: 'auto',
              padding: '16px',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
              fontSize: '12px',
              lineHeight: '1.6',
            }}>
              {logs.map(log => (
                <div key={log.id} style={{ marginBottom: log.changes ? '8px' : '0' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      ...Object.fromEntries([getLogClasses(log.type).split(': ')].map(([k, v]) => [k, v]))
                    }}
                  >
                    <span style={{ color: '#484f58', flexShrink: 0 }}>
                      {format(log.timestamp, 'HH:mm:ss', { timeZone: 'America/New_York' })}
                    </span>
                    <span style={{ flexShrink: 0 }}>{getLogIcon(log.type)}</span>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {log.message}
                    </span>
                  </div>
                  {log.changes && (
                    <div style={{
                      marginLeft: '80px',
                      marginTop: '4px',
                      padding: '8px 12px',
                      backgroundColor: '#1c2128',
                      borderRadius: '4px',
                      borderLeft: '3px solid #3b82f6',
                      fontSize: '11px',
                    }}>
                      {Array.isArray(log.changes) ? (
                        // Field changes for events, food, beers
                        (log.changes as FieldChange[]).map((change, i, arr) => (
                          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: i < arr.length - 1 ? '4px' : 0 }}>
                            <span style={{ color: '#8b949e', minWidth: '80px' }}>{change.field}:</span>
                            <span style={{ color: '#f87171', textDecoration: 'line-through' }}>
                              {change.from === null ? '(empty)' : String(change.from)}
                            </span>
                            <span style={{ color: '#6b7280' }}>→</span>
                            <span style={{ color: '#4ade80' }}>
                              {change.to === null ? '(empty)' : String(change.to)}
                            </span>
                          </div>
                        ))
                      ) : (
                        // Menu changes summary
                        (() => {
                          const menuChanges = log.changes as MenuChanges
                          return (
                            <div style={{ display: 'flex', gap: '16px' }}>
                              {menuChanges.added > 0 && (
                                <span style={{ color: '#4ade80' }}>+{menuChanges.added} added</span>
                              )}
                              {menuChanges.removed > 0 && (
                                <span style={{ color: '#f87171' }}>-{menuChanges.removed} removed</span>
                              )}
                              {menuChanges.priceChanges > 0 && (
                                <span style={{ color: '#fbbf24' }}>{menuChanges.priceChanges} price changes</span>
                              )}
                            </div>
                          )
                        })()
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Results Summary */}
        {results && (
          <div style={{
            borderRadius: '8px',
            border: results.dryRun ? '1px solid var(--theme-elevation-400)' : '1px solid var(--theme-success-400)',
            backgroundColor: results.dryRun ? 'var(--theme-elevation-50)' : 'var(--theme-success-50)',
            padding: '24px',
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: results.dryRun ? 'var(--theme-elevation-700)' : 'var(--theme-success-700)',
              marginBottom: '16px',
            }}>
              {results.dryRun ? 'Preview Results' : 'Sync Complete'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {results.events && (
                <ResultCard
                  label="Events"
                  color="#60a5fa"
                  data={results.events}
                  dryRun={results.dryRun}
                />
              )}
              {results.food && (
                <ResultCard
                  label="Food"
                  color="#c084fc"
                  data={results.food}
                  dryRun={results.dryRun}
                />
              )}
              {results.beers && (
                <ResultCard
                  label="Beers"
                  color="#fbbf24"
                  data={results.beers}
                  dryRun={results.dryRun}
                />
              )}
              {results.menus && (
                <ResultCard
                  label="Menus"
                  color="#34d399"
                  data={results.menus}
                  dryRun={results.dryRun}
                />
              )}
              {results.hours && (
                <ResultCard
                  label="Hours"
                  color="#f472b6"
                  data={results.hours}
                  dryRun={results.dryRun}
                />
              )}
            </div>
          </div>
        )}

        {/* CSV Import Section */}
        <div style={{
          marginTop: '48px',
          paddingTop: '24px',
          borderTop: '1px solid var(--theme-elevation-200)',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            marginBottom: '8px',
            color: 'var(--theme-text)'
          }}>
            Import Food Vendors from CSV
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--theme-elevation-600)',
            marginBottom: '16px'
          }}>
            Upload a CSV file with columns: vendor, social, contact, phone
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              disabled={csvUploading}
              style={{ display: 'none' }}
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '4px',
                border: 'none',
                cursor: csvUploading ? 'not-allowed' : 'pointer',
                opacity: csvUploading ? 0.6 : 1,
                backgroundColor: 'var(--theme-elevation-500)',
                color: 'white',
                transition: 'all 0.15s',
              }}
            >
              {csvUploading && (
                <svg
                  style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }}
                  viewBox="0 0 24 24"
                >
                  <circle
                    style={{ opacity: 0.25 }}
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    style={{ opacity: 0.75 }}
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {csvUploading ? 'Uploading...' : 'Choose CSV File'}
            </label>
          </div>

          {/* CSV Results */}
          {csvResults && (
            <div style={{
              marginTop: '16px',
              borderRadius: '8px',
              border: csvResults.errors > 0 && csvResults.created === 0
                ? '1px solid var(--theme-error-400)'
                : '1px solid var(--theme-success-400)',
              backgroundColor: csvResults.errors > 0 && csvResults.created === 0
                ? 'var(--theme-error-50)'
                : 'var(--theme-success-50)',
              padding: '16px',
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '8px',
                color: csvResults.errors > 0 && csvResults.created === 0
                  ? 'var(--theme-error-700)'
                  : 'var(--theme-success-700)',
              }}>
                Import Results
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '14px', marginBottom: '12px' }}>
                <span style={{ color: 'var(--theme-success-500)' }}>
                  {csvResults.created} created
                </span>
                <span style={{ color: 'var(--theme-elevation-500)' }}>
                  {csvResults.skipped} skipped
                </span>
                {csvResults.errors > 0 && (
                  <span style={{ color: 'var(--theme-error-500)' }}>
                    {csvResults.errors} errors
                  </span>
                )}
              </div>
              {csvResults.details.length > 0 && (
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: 'var(--theme-bg)',
                  padding: '12px',
                  borderRadius: '4px',
                  border: '1px solid var(--theme-elevation-150)',
                }}>
                  {csvResults.details.map((detail, i) => (
                    <div key={i} style={{
                      color: detail.startsWith('Error')
                        ? 'var(--theme-error-500)'
                        : detail.startsWith('Created')
                          ? 'var(--theme-success-500)'
                          : 'var(--theme-elevation-500)',
                    }}>
                      {detail}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Distributor Location Data Section */}
        <div style={{
          marginTop: '48px',
          paddingTop: '24px',
          borderTop: '1px solid var(--theme-elevation-200)',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            marginBottom: '8px',
            color: 'var(--theme-text)'
          }}>
            Distributor Location Data
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--theme-elevation-600)',
            marginBottom: '16px'
          }}>
            Import distributor locations from Sixth City/Encompass8 JSON feeds
          </p>

          {urlsLoading ? (
            <div style={{ color: 'var(--theme-elevation-500)', fontSize: '14px' }}>Loading...</div>
          ) : (
            <>
              {/* URL Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--theme-elevation-600)',
                    marginBottom: '4px',
                  }}>
                    Pennsylvania JSON URL
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={paUrl}
                      onChange={(e) => setPaUrl(e.target.value)}
                      placeholder="https://sixthcity.encompass8.com/QuickLink?QuickKey=..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '13px',
                        borderRadius: '4px',
                        border: '1px solid var(--theme-elevation-200)',
                        backgroundColor: 'var(--theme-input-bg)',
                        color: 'var(--theme-text)',
                      }}
                    />
                    <button
                      onClick={() => importDistributors('pa')}
                      disabled={!paUrl || distImporting !== null}
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: !paUrl || distImporting !== null ? 'not-allowed' : 'pointer',
                        opacity: !paUrl || distImporting !== null ? 0.6 : 1,
                        backgroundColor: '#fb923c',
                        color: 'white',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {distImporting === 'pa' ? 'Importing...' : 'Import PA'}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--theme-elevation-600)',
                    marginBottom: '4px',
                  }}>
                    Ohio JSON URL
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={ohUrl}
                      onChange={(e) => setOhUrl(e.target.value)}
                      placeholder="https://sixthcity.encompass8.com/QuickLink?QuickKey=..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '13px',
                        borderRadius: '4px',
                        border: '1px solid var(--theme-elevation-200)',
                        backgroundColor: 'var(--theme-input-bg)',
                        color: 'var(--theme-text)',
                      }}
                    />
                    <button
                      onClick={() => importDistributors('oh')}
                      disabled={!ohUrl || distImporting !== null}
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: !ohUrl || distImporting !== null ? 'not-allowed' : 'pointer',
                        opacity: !ohUrl || distImporting !== null ? 0.6 : 1,
                        backgroundColor: '#fb923c',
                        color: 'white',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {distImporting === 'oh' ? 'Importing...' : 'Import OH'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={saveDistributorUrls}
                  disabled={urlsSaving}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: '1px solid var(--theme-elevation-300)',
                    cursor: urlsSaving ? 'not-allowed' : 'pointer',
                    opacity: urlsSaving ? 0.6 : 1,
                    backgroundColor: 'transparent',
                    color: 'var(--theme-text)',
                  }}
                >
                  {urlsSaving ? 'Saving...' : 'Save URLs'}
                </button>
                {urlsSaveStatus === 'success' && (
                  <span style={{ color: 'var(--theme-success-500)', fontSize: '13px' }}>Saved!</span>
                )}
                {urlsSaveStatus === 'error' && (
                  <span style={{ color: 'var(--theme-error-500)', fontSize: '13px' }}>Failed to save - check console</span>
                )}
              </div>

              {/* Progress Bar for PA/OH Import */}
              {distProgress && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    marginBottom: '6px',
                    color: 'var(--theme-elevation-600)',
                  }}>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '70%',
                    }}>
                      {distProgress.name}
                    </span>
                    <span>{distProgress.current} / {distProgress.total} ({distProgress.percent}%)</span>
                  </div>
                  <div style={{
                    height: '8px',
                    backgroundColor: 'var(--theme-elevation-150)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${distProgress.percent}%`,
                      backgroundColor: '#fb923c',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* Live Details Feed */}
              {distLiveDetails.length > 0 && distImporting && (
                <div style={{
                  marginTop: '12px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: '#0d1117',
                  padding: '12px',
                  borderRadius: '4px',
                  border: '1px solid #30363d',
                }}>
                  {distLiveDetails.map((detail, i) => (
                    <div key={i} style={{
                      color: detail.startsWith('Error')
                        ? '#f87171'
                        : detail.startsWith('Imported')
                          ? '#4ade80'
                          : '#8b949e',
                      marginBottom: '2px',
                    }}>
                      {detail}
                    </div>
                  ))}
                </div>
              )}

              {/* Distributor Import Results */}
              {distResults && (
                <div style={{
                  marginTop: '16px',
                  borderRadius: '8px',
                  border: distResults.errors > 0 && distResults.imported === 0
                    ? '1px solid var(--theme-error-400)'
                    : '1px solid var(--theme-success-400)',
                  backgroundColor: distResults.errors > 0 && distResults.imported === 0
                    ? 'var(--theme-error-50)'
                    : 'var(--theme-success-50)',
                  padding: '16px',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '8px',
                    color: distResults.errors > 0 && distResults.imported === 0
                      ? 'var(--theme-error-700)'
                      : 'var(--theme-success-700)',
                  }}>
                    {distResults.region} Import Results
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '14px', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--theme-success-500)' }}>
                      {distResults.imported} imported
                    </span>
                    <span style={{ color: 'var(--theme-elevation-500)' }}>
                      {distResults.skipped} skipped
                    </span>
                    {distResults.errors > 0 && (
                      <span style={{ color: 'var(--theme-error-500)' }}>
                        {distResults.errors} errors
                      </span>
                    )}
                  </div>
                  {distResults.details.length > 0 && (
                    <div style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      backgroundColor: 'var(--theme-bg)',
                      padding: '12px',
                      borderRadius: '4px',
                      border: '1px solid var(--theme-elevation-150)',
                    }}>
                      {distResults.details.map((detail, i) => (
                        <div key={i} style={{
                          color: detail.startsWith('Error')
                            ? 'var(--theme-error-500)'
                            : detail.startsWith('Imported')
                              ? 'var(--theme-success-500)'
                              : 'var(--theme-elevation-500)',
                        }}>
                          {detail}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Lake Beverage CSV Upload */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--theme-elevation-150)' }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: 'var(--theme-text)'
                }}>
                  Lake Beverage (NY)
                </h3>
                <p style={{
                  fontSize: '13px',
                  color: 'var(--theme-elevation-600)',
                  marginBottom: '12px'
                }}>
                  Upload CSV with columns: Retail Accounts, Address, City, Account #, State, Zip Code, Phone
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <input
                    ref={lakeInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleLakeBeverageUpload}
                    disabled={lakeUploading}
                    style={{ display: 'none' }}
                    id="lake-csv-upload"
                  />
                  <label
                    htmlFor="lake-csv-upload"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 500,
                      borderRadius: '4px',
                      border: 'none',
                      cursor: lakeUploading ? 'not-allowed' : 'pointer',
                      opacity: lakeUploading ? 0.6 : 1,
                      backgroundColor: '#60a5fa',
                      color: 'white',
                      transition: 'all 0.15s',
                    }}
                  >
                    {lakeUploading && (
                      <svg
                        style={{ animation: 'spin 1s linear infinite', width: '14px', height: '14px' }}
                        viewBox="0 0 24 24"
                      >
                        <circle
                          style={{ opacity: 0.25 }}
                          cx="12" cy="12" r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          style={{ opacity: 0.75 }}
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    )}
                    {lakeUploading ? 'Importing...' : 'Upload CSV'}
                  </label>
                </div>

                {/* Progress Bar */}
                {lakeProgress && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      marginBottom: '6px',
                      color: 'var(--theme-elevation-600)',
                    }}>
                      <span>Processing: {lakeProgress.name}</span>
                      <span>{lakeProgress.current} / {lakeProgress.total} ({lakeProgress.percent}%)</span>
                    </div>
                    <div style={{
                      height: '8px',
                      backgroundColor: 'var(--theme-elevation-150)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${lakeProgress.percent}%`,
                        backgroundColor: '#60a5fa',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                )}

                {/* Lake Beverage Results */}
                {lakeResults && (
                  <div style={{
                    marginTop: '16px',
                    borderRadius: '8px',
                    border: lakeResults.errors > 0 && lakeResults.imported === 0
                      ? '1px solid var(--theme-error-400)'
                      : '1px solid var(--theme-success-400)',
                    backgroundColor: lakeResults.errors > 0 && lakeResults.imported === 0
                      ? 'var(--theme-error-50)'
                      : 'var(--theme-success-50)',
                    padding: '16px',
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: lakeResults.errors > 0 && lakeResults.imported === 0
                        ? 'var(--theme-error-700)'
                        : 'var(--theme-success-700)',
                    }}>
                      NY Import Results
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', marginBottom: '12px' }}>
                      <span style={{ color: 'var(--theme-success-500)' }}>
                        {lakeResults.imported} imported
                      </span>
                      <span style={{ color: 'var(--theme-elevation-500)' }}>
                        {lakeResults.skipped} skipped
                      </span>
                      {lakeResults.errors > 0 && (
                        <span style={{ color: 'var(--theme-error-500)' }}>
                          {lakeResults.errors} errors
                        </span>
                      )}
                    </div>
                    {lakeResults.details.length > 0 && (
                      <div style={{
                        maxHeight: '200px',
                        overflowY: 'auto',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        backgroundColor: 'var(--theme-bg)',
                        padding: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--theme-elevation-150)',
                      }}>
                        {lakeResults.details.map((detail, i) => (
                          <div key={i} style={{
                            color: detail.startsWith('Error')
                              ? 'var(--theme-error-500)'
                              : detail.startsWith('Imported')
                                ? 'var(--theme-success-500)'
                                : detail.startsWith('Warning')
                                  ? 'var(--theme-warning-500)'
                                  : 'var(--theme-elevation-500)',
                          }}>
                            {detail}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Beer Utilities Section */}
        <div style={{
          marginTop: '48px',
          paddingTop: '24px',
          borderTop: '1px solid var(--theme-elevation-200)',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            marginBottom: '8px',
            color: 'var(--theme-text)'
          }}>
            Beer Utilities
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--theme-elevation-600)',
            marginBottom: '16px'
          }}>
            Recalculate auto-computed beer fields (Half Pour, Can Single prices)
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={handleRecalculateBeerFields}
              disabled={recalcRunning}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '4px',
                border: 'none',
                cursor: recalcRunning ? 'not-allowed' : 'pointer',
                opacity: recalcRunning ? 0.6 : 1,
                backgroundColor: recalcDryRun ? '#fbbf24' : 'var(--theme-success-500)',
                color: recalcDryRun ? '#000' : 'white',
                transition: 'all 0.15s',
              }}
            >
              {recalcRunning && (
                <svg
                  style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }}
                  viewBox="0 0 24 24"
                >
                  <circle
                    style={{ opacity: 0.25 }}
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    style={{ opacity: 0.75 }}
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {recalcRunning ? (recalcDryRun ? 'Previewing...' : 'Recalculating...') : (recalcDryRun ? 'Preview Recalculation' : 'Recalculate All')}
            </button>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: 'var(--theme-text)',
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={recalcDryRun}
                onChange={(e) => setRecalcDryRun(e.target.checked)}
                disabled={recalcRunning}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Dry run (preview only)
            </label>
          </div>

          {/* Recalc Log Console */}
          {recalcLogs.length > 0 && (
            <div style={{
              marginTop: '16px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid var(--theme-elevation-150)',
              backgroundColor: '#0d1117',
            }}>
              <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid #30363d',
                backgroundColor: '#161b22',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#8b949e' }}>
                  Console Output
                </span>
              </div>
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '16px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                fontSize: '12px',
                lineHeight: '1.6',
              }}>
                {recalcLogs.map((log, i) => (
                  <div key={i} style={{
                    color: log.startsWith('Error') ? '#f87171' : '#8b949e',
                    marginBottom: '2px',
                  }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recalc Results */}
          {recalcResults && (
            <div style={{
              marginTop: '16px',
              borderRadius: '8px',
              border: recalcResults.errors > 0
                ? '1px solid var(--theme-error-400)'
                : '1px solid var(--theme-success-400)',
              backgroundColor: recalcResults.errors > 0
                ? 'var(--theme-error-50)'
                : 'var(--theme-success-50)',
              padding: '16px',
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '8px',
                color: recalcResults.errors > 0
                  ? 'var(--theme-error-700)'
                  : 'var(--theme-success-700)',
              }}>
                {recalcDryRun ? 'Preview Results' : 'Recalculation Complete'}
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
                <span style={{ color: 'var(--theme-success-500)' }}>
                  {recalcResults.updated} {recalcDryRun ? 'would update' : 'updated'}
                </span>
                {recalcResults.errors > 0 && (
                  <span style={{ color: 'var(--theme-error-500)' }}>
                    {recalcResults.errors} errors
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </Gutter>
  )
}

const ResultCard: React.FC<{
  label: string
  color: string
  data: { imported: number; updated: number; skipped: number; errors: number }
  dryRun?: boolean
}> = ({ label, color, data, dryRun }) => (
  <div style={{
    padding: '16px',
    borderRadius: '6px',
    backgroundColor: 'var(--theme-bg)',
    border: '1px solid var(--theme-elevation-150)',
  }}>
    <div style={{
      fontSize: '13px',
      fontWeight: 500,
      color: color,
      marginBottom: '4px'
    }}>
      {label}
    </div>
    <div style={{ display: 'flex', gap: '12px', fontSize: '14px', flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--theme-success-500)' }}>
        {data.imported} {dryRun ? 'to import' : 'imported'}
      </span>
      {data.updated > 0 && (
        <span style={{ color: '#60a5fa' }}>
          {data.updated} {dryRun ? 'to update' : 'updated'}
        </span>
      )}
      <span style={{ color: 'var(--theme-elevation-500)' }}>
        {data.skipped} skipped
      </span>
      {data.errors > 0 && (
        <span style={{ color: 'var(--theme-error-500)' }}>
          {data.errors} errors
        </span>
      )}
    </div>
  </div>
)

export default SyncViewClient
