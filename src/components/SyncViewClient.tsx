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
  type: 'status' | 'event' | 'food' | 'beer' | 'menu' | 'error' | 'complete'
  message: string
  timestamp: Date
  changes?: FieldChange[] | MenuChanges
}

type CollectionType = 'events' | 'food' | 'beers' | 'menus'

interface SyncResults {
  events?: { imported: number; updated: number; skipped: number; errors: number }
  food?: { imported: number; updated: number; skipped: number; errors: number }
  beers?: { imported: number; updated: number; skipped: number; errors: number }
  menus?: { imported: number; updated: number; skipped: number; errors: number }
  dryRun?: boolean
}

export const SyncViewClient: React.FC = () => {
  const [syncing, setSyncing] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [selectedCollections, setSelectedCollections] = useState<CollectionType[]>(['events', 'food', 'beers', 'menus'])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [results, setResults] = useState<SyncResults | null>(null)
  const logIdRef = useRef(0)
  const logsEndRef = useRef<HTMLDivElement>(null)

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
        credentials: 'include',
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
                    addLog('event', `Event: ${data.vendor} (${data.date}) - ${data.location}`, data.changes)
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
      case 'error': return '✗'
      case 'complete': return '●'
      default: return '→'
    }
  }

  const collectionLabels: Record<CollectionType, string> = {
    events: 'Events',
    food: 'Food',
    beers: 'Beers',
    menus: 'Menus',
  }

  const collectionColors: Record<CollectionType, string> = {
    events: '#60a5fa',
    food: '#c084fc',
    beers: '#fbbf24',
    menus: '#34d399',
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
            {(Object.keys(collectionLabels) as CollectionType[]).map(collection => (
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
            </div>
          </div>
        )}

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
