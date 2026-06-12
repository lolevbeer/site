'use client'

import React, { useState, useRef } from 'react'
import { Gutter, SetStepNav, Button, Banner, Pill } from '@payloadcms/ui'
import { format } from 'date-fns-tz'
import { getSiteContentData } from '@/src/actions/admin-data'
import { useSSEImport, type SSEData } from '@/lib/hooks/use-sse-import'
import { logger } from '@/lib/utils/logger'

interface FieldChange {
  field: string
  from: unknown
  to: unknown
}

interface MenuChanges {
  added: number
  removed: number
  priceChanges: number
}

type CollectionType = 'events' | 'food' | 'beers' | 'menus' | 'hours'

interface SyncResults {
  events?: { imported: number; updated: number; skipped: number; errors: number }
  food?: { imported: number; updated: number; skipped: number; errors: number }
  beers?: { imported: number; updated: number; skipped: number; errors: number }
  menus?: { imported: number; updated: number; skipped: number; errors: number }
  hours?: { imported: number; updated: number; skipped: number; errors: number }
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

interface RecalcResults {
  updated: number
  skipped: number
  errors: number
}

interface UntappdResults {
  total: number
  refreshed: number
  updated: number
  skipped: number
  errors: number
}

interface RegeocodeDistributor {
  name: string
  address: string
  city: string
  state: string
  zip: string
  fullAddress?: string
}

interface RegeocodeResults {
  checked: number
  suspicious: number
  fixed: number
  failed: number
  distributors?: RegeocodeDistributor[]
}

interface SyncViewClientProps {
  isAdmin: boolean
}

export const SyncViewClient: React.FC<SyncViewClientProps> = ({ isAdmin }) => {
  const [dryRun, setDryRun] = useState(true)
  const [selectedCollections, setSelectedCollections] = useState<CollectionType[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)
  // Google Sheets sync. Log entries carry the per-record field changes as
  // `data` so the console can render before/after diffs.
  const sheets = useSSEImport<SyncResults>({
    logLimit: Infinity,
    handlers: ({ appendLog, setResults }) => ({
      event: raw => { const d = raw as SSEData; appendLog('event', `Event: ${d.organizer} (${d.date}) - ${d.location}`, d.changes) },
      food: raw => { const d = raw as SSEData; appendLog('food', `Food: ${d.vendor} (${d.date}) - ${d.location}`, d.changes) },
      beer: raw => { const d = raw as SSEData; appendLog('beer', `Beer: ${d.name} (${d.style})`, d.changes) },
      menu: raw => { const d = raw as SSEData; appendLog('menu', `Menu: ${d.location} ${d.type} - ${d.itemCount} items`, d.changes) },
      hours: raw => { const d = raw as SSEData; appendLog('hours', `Hours: ${d.location} - ${d.action}`, d.changes) },
      error: raw => { const d = raw as SSEData; appendLog('error', String(d.message ?? '')) },
      complete: raw => {
        const d = raw as SSEData
        if (d.success) {
          setResults({ ...(d.results as SyncResults), dryRun: d.dryRun as boolean })
          appendLog('complete', d.dryRun ? 'Preview complete!' : 'Sync complete!')
        } else {
          appendLog('error', `Sync failed: ${d.error}`)
        }
      },
    }),
    onJSON: (_data, response, { appendLog }) => { appendLog('error', `HTTP error: ${response.status}`) },
    onException: (error, { appendLog }) => { appendLog('error', `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`) },
  })

  // Keep the console scrolled to the newest entry
  React.useEffect(() => {
    if (sheets.logs.length > 0) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [sheets.logs])

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
  // Which region is importing; per-run callbacks passed to dist.run() carry the
  // region into results, so this only drives the buttons/live-feed visibility.
  const [distImporting, setDistImporting] = useState<'pa' | 'oh' | null>(null)
  const dist = useSSEImport<DistributorImportResult>({
    logLimit: 50,
    handlers: ({ appendLog }) => ({
      // Server item payloads carry their own type: 'success' | 'skip' | 'error'
      item: raw => {
        const data = raw as SSEData
        appendLog(String(data.type ?? 'status'), String(data.message ?? ''))
      },
    }),
  })

  // Lake Beverage CSV import state
  const lakeInputRef = useRef<HTMLInputElement>(null)
  const lake = useSSEImport<DistributorImportResult>({
    getResults: data => ({
      region: 'NY',
      imported: (data.imported as number) || 0,
      skipped: (data.skipped as number) || 0,
      errors: (data.errors as number) || 0,
      details: (data.details as string[]) || [],
    }),
    onJSON: (data, _response, { setResults }) => {
      setResults({
        region: 'NY',
        imported: 0,
        skipped: 0,
        errors: 1,
        details: [String(data.error || 'Upload failed')],
      })
    },
    onException: (error, { setResults }) => {
      setResults({
        region: 'NY',
        imported: 0,
        skipped: 0,
        errors: 1,
        details: [error instanceof Error ? error.message : 'Upload failed'],
      })
    },
  })

  // Recalculate beer fields state
  const [recalcDryRun, setRecalcDryRun] = useState(true)
  const recalc = useSSEImport<RecalcResults>({
    getResults: data => (data.results as RecalcResults) ?? null,
  })

  // Re-geocode distributors state
  const [regeocodeDryRun, setRegeocodeDryRun] = useState(true)
  const regeocode = useSSEImport<RegeocodeResults>({
    getResults: data => ({
      checked: (data.checked as number) || 0,
      suspicious: (data.suspicious as number) || 0,
      fixed: (data.fixed as number) || 0,
      failed: (data.failed as number) || 0,
    }),
    handlers: ({ appendLog }) => ({
      item: raw => {
        const data = raw as SSEData
        if (data.status === 'fixed') appendLog('success', `Fixed: ${data.name}`)
        else if (data.status === 'skipped') appendLog('status', `Skipped: ${data.name} - ${data.note}`)
        else appendLog('error', `Failed: ${data.name} - ${data.note || data.error}`)
      },
    }),
    onJSON: (data, response, { appendLog, setResults }) => {
      if (!response.ok) {
        setResults({ checked: 0, suspicious: 0, fixed: 0, failed: 1 })
        appendLog('error', `Error: ${data.error || 'Request failed'}`)
        return
      }
      // JSON success fallback: dry run report, or no suspicious coordinates found
      setResults({
        checked: (data.checked as number) || 0,
        suspicious: (data.suspicious as number) || 0,
        fixed: (data.fixed as number) || 0,
        failed: 0,
        distributors: data.distributors as RegeocodeDistributor[] | undefined,
      })
    },
  })

  // Untappd sync state
  const [untappdDryRun, setUntappdDryRun] = useState(true)
  const untappd = useSSEImport<UntappdResults>({
    getResults: data => (data.results as UntappdResults) ?? null,
    handlers: ({ appendLog }) => ({
      item: raw => {
        const data = raw as SSEData
        const statusIcon = data.status === 'refreshed' ? '✓'
          : data.status === 'updated' || data.status === 'new' ? '+'
          : data.status === 'error' ? '✗'
          : data.status === 'multiple' ? '?'
          : data.status === 'not-found' ? '○'
          : '→'
        appendLog(String(data.status ?? 'item'), `${statusIcon} ${data.name}: ${data.message}`)
      },
    }),
  })

  // Load distributor URLs on mount using local API
  React.useEffect(() => {
    getSiteContentData()
      .then(data => {
        setPaUrl(data.distributorPaUrl || '')
        setOhUrl(data.distributorOhUrl || '')
      })
      .catch(() => {})
      .finally(() => setUrlsLoading(false))
  }, [])

  const toggleCollection = (collection: CollectionType) => {
    setSelectedCollections(prev =>
      prev.includes(collection)
        ? prev.filter(c => c !== collection)
        : [...prev, collection]
    )
  }

  const handleSync = async () => {
    if (selectedCollections.length === 0) {
      sheets.appendLog('error', 'Please select at least one collection to sync')
      return
    }

    const params = new URLSearchParams()
    if (dryRun) params.set('dryRun', 'true')
    params.set('collections', selectedCollections.join(','))
    await sheets.run(`/api/sync-google-sheets?${params.toString()}`)
  }

  const getLogClasses = (type: string) => {
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

  const getLogIcon = (type: string) => {
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
        logger.error('Failed to save URLs:', undefined, { status: response.status, error: data.error })
        setUrlsSaveStatus('error')
      } else {
        setUrlsSaveStatus('success')
        setTimeout(() => setUrlsSaveStatus('idle'), 3000)
      }
    } catch (error) {
      logger.error('Failed to save URLs:', error)
      setUrlsSaveStatus('error')
    } finally {
      setUrlsSaving(false)
    }
  }

  const importDistributors = async (region: 'pa' | 'oh') => {
    const url = region === 'pa' ? paUrl : ohUrl
    if (!url) {
      dist.setResults({
        region: region.toUpperCase(),
        imported: 0,
        skipped: 0,
        errors: 1,
        details: [`No URL configured for ${region.toUpperCase()}`],
      })
      return
    }

    setDistImporting(region)
    try {
      await dist.run(`/api/import-distributors?region=${region}`, {
        getResults: data => ({
          region: region.toUpperCase(),
          imported: (data.imported as number) || 0,
          skipped: (data.skipped as number) || 0,
          errors: (data.errors as number) || 0,
          details: (data.details as string[]) || [],
        }),
        // JSON (non-streaming) responses are error payloads for this endpoint
        onJSON: (data, _response, { setResults }) => {
          const details: string[] = []
          if (data.error) details.push(`Error: ${data.error}`)
          if (data.details) details.push(...(data.details as string[]))
          setResults({
            region: region.toUpperCase(),
            imported: (data.imported as number) || 0,
            skipped: (data.skipped as number) || 0,
            errors: (data.errors as number) || 1,
            details,
          })
        },
        onException: (error, { setResults }) => {
          setResults({
            region: region.toUpperCase(),
            imported: 0,
            skipped: 0,
            errors: 1,
            details: [`Network error: ${error instanceof Error ? error.message : 'Import failed'}`],
          })
        },
      })
    } finally {
      setDistImporting(null)
    }
  }

  const handleLakeBeverageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    await lake.run('/api/import-lake-beverage-csv', { body: formData })

    if (lakeInputRef.current) {
      lakeInputRef.current.value = ''
    }
  }

  // Default useSSEImport handlers cover this flow entirely:
  // status/error events become log entries, `complete` carries the results.
  const handleRecalculateBeerFields = async () => {
    const params = new URLSearchParams()
    if (recalcDryRun) params.set('dryRun', 'true')
    await recalc.run(`/api/recalculate-beer-prices?${params.toString()}`)
  }

  const handleRegeocodeDistributors = async () => {
    const params = new URLSearchParams()
    if (regeocodeDryRun) params.set('dryRun', 'true')
    await regeocode.run(`/api/regeocode-distributors?${params.toString()}`)
  }

  const handleUntappdSync = async () => {
    const params = new URLSearchParams()
    if (untappdDryRun) params.set('dryRun', 'true')
    await untappd.run(`/api/sync-untappd-ratings?${params.toString()}`)
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
    } catch (error: unknown) {
      setCsvResults({
        success: false,
        total: 0,
        created: 0,
        skipped: 0,
        errors: 1,
        details: [error instanceof Error ? error.message : 'Upload failed'],
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
      <SetStepNav nav={[{ label: 'Sync' }]} />
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
                disabled={sheets.running}
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
                  cursor: sheets.running ? 'not-allowed' : 'pointer',
                  opacity: sheets.running ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {collectionLabels[collection]}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Button
              onClick={handleSync}
              disabled={sheets.running || selectedCollections.length === 0}
              buttonStyle={dryRun ? 'secondary' : 'primary'}
              size="small"
            >
              {sheets.running ? (dryRun ? 'Previewing...' : 'Syncing...') : (dryRun ? 'Preview' : 'Sync Now')}
            </Button>
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
                disabled={sheets.running}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Dry run (preview only)
            </label>
          </div>
        </div>

        {/* Log Console */}
        {sheets.logs.length > 0 && (
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
              {sheets.logs.map(log => (
                <div key={log.id} style={{ marginBottom: log.data ? '8px' : '0' }}>
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
                  {log.data != null && (
                    <div style={{
                      marginLeft: '80px',
                      marginTop: '4px',
                      padding: '8px 12px',
                      backgroundColor: '#1c2128',
                      borderRadius: '4px',
                      borderLeft: '3px solid #3b82f6',
                      fontSize: '11px',
                    }}>
                      {Array.isArray(log.data) ? (
                        // Field changes for events, food, beers
                        (log.data as FieldChange[]).map((change, i, arr) => (
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
                          const menuChanges = log.data as MenuChanges
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
        {sheets.results && (
          <div style={{
            borderRadius: '8px',
            border: sheets.results.dryRun ? '1px solid var(--theme-elevation-400)' : '1px solid var(--theme-success-400)',
            backgroundColor: sheets.results.dryRun ? 'var(--theme-elevation-50)' : 'var(--theme-success-50)',
            padding: '24px',
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: sheets.results.dryRun ? 'var(--theme-elevation-700)' : 'var(--theme-success-700)',
              marginBottom: '16px',
            }}>
              {sheets.results.dryRun ? 'Preview Results' : 'Sync Complete'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {sheets.results.events && (
                <ResultCard
                  label="Events"
                  color="#60a5fa"
                  data={sheets.results.events}
                  dryRun={sheets.results.dryRun}
                />
              )}
              {sheets.results.food && (
                <ResultCard
                  label="Food"
                  color="#c084fc"
                  data={sheets.results.food}
                  dryRun={sheets.results.dryRun}
                />
              )}
              {sheets.results.beers && (
                <ResultCard
                  label="Beers"
                  color="#fbbf24"
                  data={sheets.results.beers}
                  dryRun={sheets.results.dryRun}
                />
              )}
              {sheets.results.menus && (
                <ResultCard
                  label="Menus"
                  color="#34d399"
                  data={sheets.results.menus}
                  dryRun={sheets.results.dryRun}
                />
              )}
              {sheets.results.hours && (
                <ResultCard
                  label="Hours"
                  color="#f472b6"
                  data={sheets.results.hours}
                  dryRun={sheets.results.dryRun}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              disabled={csvUploading}
              style={{ display: 'none' }}
              id="csv-upload"
            />
            <Button
              onClick={() => csvInputRef.current?.click()}
              disabled={csvUploading}
              buttonStyle="secondary"
              size="small"
            >
              {csvUploading ? 'Uploading...' : 'Choose CSV File'}
            </Button>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--theme-elevation-600)',
                    marginBottom: '2px',
                  }}>
                    Pennsylvania JSON URL
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={paUrl}
                      onChange={(e) => setPaUrl(e.target.value)}
                      placeholder="Paste URL..."
                      style={{
                        width: '600px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--theme-elevation-200)',
                        backgroundColor: 'var(--theme-input-bg)',
                        color: 'var(--theme-text)',
                      }}
                    />
                    <Button
                      onClick={() => importDistributors('pa')}
                      disabled={!paUrl || distImporting !== null}
                      buttonStyle="primary"
                      size="small"
                    >
                      {distImporting === 'pa' ? 'Importing...' : 'Import PA'}
                    </Button>
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--theme-elevation-600)',
                    marginBottom: '2px',
                  }}>
                    Ohio JSON URL
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={ohUrl}
                      onChange={(e) => setOhUrl(e.target.value)}
                      placeholder="Paste URL..."
                      style={{
                        width: '600px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--theme-elevation-200)',
                        backgroundColor: 'var(--theme-input-bg)',
                        color: 'var(--theme-text)',
                      }}
                    />
                    <Button
                      onClick={() => importDistributors('oh')}
                      disabled={!ohUrl || distImporting !== null}
                      buttonStyle="primary"
                      size="small"
                    >
                      {distImporting === 'oh' ? 'Importing...' : 'Import OH'}
                    </Button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Button
                  onClick={saveDistributorUrls}
                  disabled={urlsSaving}
                  buttonStyle="secondary"
                  size="small"
                >
                  {urlsSaving ? 'Saving...' : 'Save URLs'}
                </Button>
                {urlsSaveStatus === 'success' && (
                  <span style={{ color: 'var(--theme-success-500)', fontSize: '13px' }}>Saved!</span>
                )}
                {urlsSaveStatus === 'error' && (
                  <span style={{ color: 'var(--theme-error-500)', fontSize: '13px' }}>Failed to save - check console</span>
                )}
              </div>

              {/* Progress Bar for PA/OH Import */}
              {dist.progress && (
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
                      {dist.progress.name}
                    </span>
                    <span>{dist.progress.current} / {dist.progress.total} ({dist.progress.percent}%)</span>
                  </div>
                  <div style={{
                    height: '8px',
                    backgroundColor: 'var(--theme-elevation-150)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${dist.progress.percent}%`,
                      backgroundColor: '#fb923c',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* Live Details Feed */}
              {dist.logs.length > 0 && distImporting && (
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
                  {dist.logs.map(log => (
                    <div key={log.id} style={{
                      color: log.type === 'error'
                        ? '#f87171'
                        : log.type === 'success'
                          ? '#4ade80'
                          : '#8b949e',
                      marginBottom: '2px',
                    }}>
                      {log.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Distributor Import Results */}
              {dist.results && (
                <div style={{
                  marginTop: '16px',
                  borderRadius: '8px',
                  border: dist.results.errors > 0 && dist.results.imported === 0
                    ? '1px solid var(--theme-error-400)'
                    : '1px solid var(--theme-success-400)',
                  backgroundColor: dist.results.errors > 0 && dist.results.imported === 0
                    ? 'var(--theme-error-50)'
                    : 'var(--theme-success-50)',
                  padding: '16px',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '8px',
                    color: dist.results.errors > 0 && dist.results.imported === 0
                      ? 'var(--theme-error-700)'
                      : 'var(--theme-success-700)',
                  }}>
                    {dist.results.region} Import Results
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '14px', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--theme-success-500)' }}>
                      {dist.results.imported} imported
                    </span>
                    <span style={{ color: 'var(--theme-elevation-500)' }}>
                      {dist.results.skipped} skipped
                    </span>
                    {dist.results.errors > 0 && (
                      <span style={{ color: 'var(--theme-error-500)' }}>
                        {dist.results.errors} errors
                      </span>
                    )}
                  </div>
                  {dist.results.details.length > 0 && (
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
                      {dist.results.details.map((detail, i) => (
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    ref={lakeInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleLakeBeverageUpload}
                    disabled={lake.running}
                    style={{ display: 'none' }}
                    id="lake-csv-upload"
                  />
                  <Button
                    onClick={() => lakeInputRef.current?.click()}
                    disabled={lake.running}
                    buttonStyle="secondary"
                    size="small"
                  >
                    {lake.running ? 'Importing...' : 'Upload CSV'}
                  </Button>
                </div>

                {/* Progress Bar */}
                {lake.progress && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      marginBottom: '6px',
                      color: 'var(--theme-elevation-600)',
                    }}>
                      <span>Processing: {lake.progress.name}</span>
                      <span>{lake.progress.current} / {lake.progress.total} ({lake.progress.percent}%)</span>
                    </div>
                    <div style={{
                      height: '8px',
                      backgroundColor: 'var(--theme-elevation-150)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${lake.progress.percent}%`,
                        backgroundColor: '#60a5fa',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                )}

                {/* Lake Beverage Results */}
                {lake.results && (
                  <div style={{
                    marginTop: '16px',
                    borderRadius: '8px',
                    border: lake.results.errors > 0 && lake.results.imported === 0
                      ? '1px solid var(--theme-error-400)'
                      : '1px solid var(--theme-success-400)',
                    backgroundColor: lake.results.errors > 0 && lake.results.imported === 0
                      ? 'var(--theme-error-50)'
                      : 'var(--theme-success-50)',
                    padding: '16px',
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: lake.results.errors > 0 && lake.results.imported === 0
                        ? 'var(--theme-error-700)'
                        : 'var(--theme-success-700)',
                    }}>
                      NY Import Results
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', marginBottom: '12px' }}>
                      <span style={{ color: 'var(--theme-success-500)' }}>
                        {lake.results.imported} imported
                      </span>
                      <span style={{ color: 'var(--theme-elevation-500)' }}>
                        {lake.results.skipped} skipped
                      </span>
                      {lake.results.errors > 0 && (
                        <span style={{ color: 'var(--theme-error-500)' }}>
                          {lake.results.errors} errors
                        </span>
                      )}
                    </div>
                    {lake.results.details.length > 0 && (
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
                        {lake.results.details.map((detail, i) => (
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

              {/* Fix Bad Coordinates Section */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--theme-elevation-150)' }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: 'var(--theme-text)'
                }}>
                  Fix Bad Coordinates
                </h3>
                <p style={{
                  fontSize: '13px',
                  color: 'var(--theme-elevation-600)',
                  marginBottom: '12px'
                }}>
                  Find and re-geocode distributors that have default/fallback coordinates (Pittsburgh, Columbus, or Rochester center)
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <Button
                    onClick={handleRegeocodeDistributors}
                    disabled={regeocode.running}
                    buttonStyle={regeocodeDryRun ? 'secondary' : 'primary'}
                    size="small"
                  >
                    {regeocode.running ? (regeocodeDryRun ? 'Scanning...' : 'Fixing...') : (regeocodeDryRun ? 'Find Bad Coords' : 'Fix Bad Coords')}
                  </Button>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: 'var(--theme-text)',
                    cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={regeocodeDryRun}
                      onChange={(e) => setRegeocodeDryRun(e.target.checked)}
                      disabled={regeocode.running}
                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                    Dry run (preview only)
                  </label>
                </div>

                {/* Progress Bar */}
                {regeocode.progress && (
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
                        {regeocode.progress.name}
                      </span>
                      <span>{regeocode.progress.current} / {regeocode.progress.total} ({regeocode.progress.percent}%)</span>
                    </div>
                    <div style={{
                      height: '8px',
                      backgroundColor: 'var(--theme-elevation-150)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${regeocode.progress.percent}%`,
                        backgroundColor: '#a855f7',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                )}

                {/* Log Console */}
                {regeocode.logs.length > 0 && (
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
                    {regeocode.logs.map(log => (
                      <div key={log.id} style={{
                        color: log.type === 'success'
                          ? '#4ade80'
                          : log.type === 'error'
                            ? '#f87171'
                            : '#8b949e',
                        marginBottom: '2px',
                      }}>
                        {log.message}
                      </div>
                    ))}
                  </div>
                )}

                {/* Results */}
                {regeocode.results && (
                  <div style={{
                    marginTop: '16px',
                    borderRadius: '8px',
                    border: regeocode.results.fixed > 0 || regeocode.results.suspicious === 0
                      ? '1px solid var(--theme-success-400)'
                      : '1px solid var(--theme-elevation-400)',
                    backgroundColor: regeocode.results.fixed > 0 || regeocode.results.suspicious === 0
                      ? 'var(--theme-success-50)'
                      : 'var(--theme-elevation-50)',
                    padding: '16px',
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: regeocode.results.fixed > 0 || regeocode.results.suspicious === 0
                        ? 'var(--theme-success-700)'
                        : 'var(--theme-elevation-700)',
                    }}>
                      {regeocodeDryRun ? 'Scan Results' : 'Fix Results'}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--theme-elevation-600)' }}>
                        {regeocode.results.checked} checked
                      </span>
                      <span style={{ color: regeocode.results.suspicious > 0 ? '#f59e0b' : 'var(--theme-success-500)' }}>
                        {regeocode.results.suspicious} with bad coords
                      </span>
                      {!regeocodeDryRun && regeocode.results.fixed > 0 && (
                        <span style={{ color: 'var(--theme-success-500)' }}>
                          {regeocode.results.fixed} fixed
                        </span>
                      )}
                      {!regeocodeDryRun && regeocode.results.failed > 0 && (
                        <span style={{ color: 'var(--theme-error-500)' }}>
                          {regeocode.results.failed} failed
                        </span>
                      )}
                    </div>
                    {/* List of distributors with bad coords (dry run) */}
                    {regeocodeDryRun && regeocode.results.distributors && regeocode.results.distributors.length > 0 && (
                      <div style={{
                        marginTop: '12px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        backgroundColor: 'var(--theme-bg)',
                        padding: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--theme-elevation-150)',
                      }}>
                        {regeocode.results.distributors.map((dist: RegeocodeDistributor, i: number) => (
                          <div key={i} style={{ marginBottom: '8px', color: 'var(--theme-elevation-600)' }}>
                            <strong style={{ color: 'var(--theme-text)' }}>{dist.name}</strong>
                            <br />
                            <span style={{ fontSize: '11px' }}>
                              Address: {dist.address === '(missing)' ? <span style={{ color: '#f87171' }}>(missing)</span> : dist.address}
                            </span>
                            <br />
                            <span style={{ fontSize: '11px' }}>
                              City: {dist.city === '(missing)' ? <span style={{ color: '#f87171' }}>(missing)</span> : dist.city},
                              State: {dist.state === '(missing)' ? <span style={{ color: '#f87171' }}>(missing)</span> : dist.state},
                              Zip: {dist.zip === '(missing)' ? <span style={{ color: '#f87171' }}>(missing)</span> : dist.zip}
                            </span>
                            {dist.fullAddress && (
                              <>
                                <br />
                                <span style={{ fontSize: '10px', color: '#8b949e' }}>
                                  Will geocode: "{dist.fullAddress}"
                                </span>
                              </>
                            )}
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

        {/* Beer Utilities Section - Admin Only */}
        {isAdmin && (
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Button
              onClick={handleRecalculateBeerFields}
              disabled={recalc.running}
              buttonStyle={recalcDryRun ? 'secondary' : 'primary'}
              size="small"
            >
              {recalc.running ? (recalcDryRun ? 'Previewing...' : 'Recalculating...') : (recalcDryRun ? 'Preview Recalculation' : 'Recalculate All')}
            </Button>
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
                disabled={recalc.running}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Dry run (preview only)
            </label>
          </div>

          {/* Recalc Log Console */}
          {recalc.logs.length > 0 && (
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
                {recalc.logs.map(log => (
                  <div key={log.id} style={{
                    color: log.type === 'error' ? '#f87171' : '#8b949e',
                    marginBottom: '2px',
                  }}>
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recalc Results */}
          {recalc.results && (
            <div style={{
              marginTop: '16px',
              borderRadius: '8px',
              border: recalc.results.errors > 0
                ? '1px solid var(--theme-error-400)'
                : '1px solid var(--theme-success-400)',
              backgroundColor: recalc.results.errors > 0
                ? 'var(--theme-error-50)'
                : 'var(--theme-success-50)',
              padding: '16px',
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '8px',
                color: recalc.results.errors > 0
                  ? 'var(--theme-error-700)'
                  : 'var(--theme-success-700)',
              }}>
                {recalcDryRun ? 'Preview Results' : 'Recalculation Complete'}
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
                <span style={{ color: 'var(--theme-success-500)' }}>
                  {recalc.results.updated} {recalcDryRun ? 'would update' : 'updated'}
                </span>
                {recalc.results.errors > 0 && (
                  <span style={{ color: 'var(--theme-error-500)' }}>
                    {recalc.results.errors} errors
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Untappd Sync Section */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--theme-elevation-150)' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--theme-text)'
            }}>
              Sync Untappd Ratings
            </h3>
            <p style={{
              fontSize: '13px',
              color: 'var(--theme-elevation-600)',
              marginBottom: '12px'
            }}>
              Bulk update Untappd ratings for all beers. Invalid URLs will be searched and fixed automatically.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <Button
                onClick={handleUntappdSync}
                disabled={untappd.running}
                buttonStyle={untappdDryRun ? 'secondary' : 'primary'}
                size="small"
              >
                {untappd.running ? (untappdDryRun ? 'Previewing...' : 'Syncing...') : (untappdDryRun ? 'Preview Sync' : 'Sync Now')}
              </Button>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--theme-text)',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={untappdDryRun}
                  onChange={(e) => setUntappdDryRun(e.target.checked)}
                  disabled={untappd.running}
                  style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                />
                Dry run (preview only)
              </label>
            </div>

            {/* Progress Bar */}
            {untappd.progress && (
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
                    {untappd.progress.name}
                  </span>
                  <span>{untappd.progress.current} / {untappd.progress.total} ({untappd.progress.percent}%)</span>
                </div>
                <div style={{
                  height: '8px',
                  backgroundColor: 'var(--theme-elevation-150)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${untappd.progress.percent}%`,
                    backgroundColor: '#f59e0b',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Log Console */}
            {untappd.logs.length > 0 && (
              <div style={{
                marginTop: '12px',
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '12px',
                fontFamily: 'monospace',
                backgroundColor: '#0d1117',
                padding: '12px',
                borderRadius: '4px',
                border: '1px solid #30363d',
              }}>
                {untappd.logs.map(log => (
                  <div key={log.id} style={{
                    color: log.type === 'refreshed'
                      ? '#4ade80'
                      : log.type === 'updated' || log.type === 'new'
                        ? '#60a5fa'
                        : log.type === 'error'
                          ? '#f87171'
                          : log.type === 'multiple'
                            ? '#fbbf24'
                            : log.type === 'not-found'
                              ? '#6b7280'
                              : '#8b949e',
                    marginBottom: '2px',
                  }}>
                    {log.message}
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {untappd.results && (
              <div style={{ marginTop: '16px' }}>
              <Banner
                type={untappd.results.errors > 0 ? 'error' : 'success'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <strong>{untappdDryRun ? 'Preview Results' : 'Sync Complete'}</strong>
                  <Pill pillStyle="light">{untappd.results.total} total</Pill>
                  <Pill pillStyle="success">{untappd.results.refreshed} refreshed</Pill>
                  {untappd.results.updated > 0 && (
                    <Pill pillStyle="warning">{untappd.results.updated} fixed</Pill>
                  )}
                  <Pill pillStyle="light">{untappd.results.skipped} skipped</Pill>
                  {untappd.results.errors > 0 && (
                    <Pill pillStyle="error">{untappd.results.errors} errors</Pill>
                  )}
                </div>
              </Banner>
              </div>
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
