'use client'

import React, { useState, useRef } from 'react'
import { Gutter, SetStepNav, Button, Banner, Pill, CheckboxInput, toast } from '@payloadcms/ui'
import { getSiteContentData } from '@/src/actions/admin-data'
import {
  useSSEImport,
  type SSEData,
  type ProgressData,
  type ImportLogEntry,
} from '@/lib/hooks/use-sse-import'
import { logger } from '@/lib/utils/logger'

import './SyncViewClient.scss'

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

// No props: SyncView.tsx already gates this view to admins server-side.
export const SyncViewClient: React.FC = () => {
  // Distributor import state
  const [paUrl, setPaUrl] = useState('')
  const [ohUrl, setOhUrl] = useState('')
  const [urlsLoading, setUrlsLoading] = useState(true)
  const [urlsSaving, setUrlsSaving] = useState(false)
  // Which region is importing; per-run callbacks passed to dist.run() carry the
  // region into results, so this only drives the buttons/live-feed visibility.
  const [distImporting, setDistImporting] = useState<'pa' | 'oh' | null>(null)
  const dist = useSSEImport<DistributorImportResult>({
    logLimit: 50,
    handlers: ({ appendLog }) => ({
      // Server item payloads carry their own type: 'success' | 'skip' | 'error'
      item: (raw) => {
        const data = raw as SSEData
        appendLog(String(data.type ?? 'status'), String(data.message ?? ''))
      },
    }),
  })

  // Lake Beverage CSV import state
  const lakeInputRef = useRef<HTMLInputElement>(null)
  const lake = useSSEImport<DistributorImportResult>({
    getResults: (data) => ({
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
    getResults: (data) => (data.results as RecalcResults) ?? null,
  })

  // Re-geocode distributors state
  const [regeocodeDryRun, setRegeocodeDryRun] = useState(true)
  const regeocode = useSSEImport<RegeocodeResults>({
    getResults: (data) => ({
      checked: (data.checked as number) || 0,
      suspicious: (data.suspicious as number) || 0,
      fixed: (data.fixed as number) || 0,
      failed: (data.failed as number) || 0,
    }),
    handlers: ({ appendLog }) => ({
      item: (raw) => {
        const data = raw as SSEData
        if (data.status === 'fixed') appendLog('success', `Fixed: ${data.name}`)
        else if (data.status === 'skipped')
          appendLog('status', `Skipped: ${data.name} - ${data.note}`)
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
    getResults: (data) => (data.results as UntappdResults) ?? null,
    handlers: ({ appendLog }) => ({
      item: (raw) => {
        const data = raw as SSEData
        const statusIcon =
          data.status === 'refreshed'
            ? '✓'
            : data.status === 'updated' || data.status === 'new'
              ? '+'
              : data.status === 'error'
                ? '✗'
                : data.status === 'multiple'
                  ? '?'
                  : data.status === 'not-found'
                    ? '○'
                    : '→'
        appendLog(String(data.status ?? 'item'), `${statusIcon} ${data.name}: ${data.message}`)
      },
    }),
  })

  // Load distributor URLs on mount using local API
  React.useEffect(() => {
    getSiteContentData()
      .then((data) => {
        setPaUrl(data.distributorPaUrl || '')
        setOhUrl(data.distributorOhUrl || '')
      })
      .catch(() => {})
      .finally(() => setUrlsLoading(false))
  }, [])

  /** Returns true when the save succeeded, so import can refuse to run against a stale URL. */
  const saveDistributorUrls = async (): Promise<boolean> => {
    setUrlsSaving(true)
    try {
      const response = await fetch('/api/update-distributor-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ distributorPaUrl: paUrl, distributorOhUrl: ohUrl }),
      })

      if (!response.ok) {
        const data = await response.json()
        logger.error('Failed to save URLs:', undefined, {
          status: response.status,
          error: data.error,
        })
        toast.error('Failed to save distributor URLs')
        return false
      }
      toast.success('Distributor URLs saved')
      return true
    } catch (error) {
      logger.error('Failed to save URLs:', error)
      toast.error('Failed to save distributor URLs')
      return false
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

    // The server reads the URL from the saved global, not this form — save
    // first so pasting a fresh QuickLink and clicking Import doesn't silently
    // run the stale (likely expired) one.
    if (!(await saveDistributorUrls())) return

    setDistImporting(region)
    try {
      await dist.run(`/api/import-distributors?region=${region}`, {
        getResults: (data) => ({
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

  return (
    <Gutter>
      <SetStepNav nav={[{ label: 'Sync' }]} />
      <div className="sync-view">
        {/* Header */}
        <div className="sync-view__intro">
          <h1 className="sync-view__title">Sync</h1>
          <p className="sync-view__description">
            Import and maintenance tools for distributor and beer data.
          </p>
        </div>

        {/* Distributor Location Data Section */}
        <div className="sync-view__section">
          <h2 className="sync-view__section-title">Distributor Location Data</h2>
          <p className="sync-view__description">
            Import distributor locations from Sixth City/Encompass8 JSON feeds
          </p>

          {urlsLoading ? (
            <div className="sync-view__loading">Loading...</div>
          ) : (
            <>
              {/* URL Inputs */}
              <div className="sync-view__url-field">
                <label className="sync-view__url-label" htmlFor="dist-url-pa">
                  Pennsylvania JSON URL
                </label>
                <div className="sync-view__url-row">
                  <input
                    id="dist-url-pa"
                    type="text"
                    className="sync-view__url-input"
                    value={paUrl}
                    onChange={(e) => setPaUrl(e.target.value)}
                    placeholder="Paste URL..."
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

              <div className="sync-view__url-field">
                <label className="sync-view__url-label" htmlFor="dist-url-oh">
                  Ohio JSON URL
                </label>
                <div className="sync-view__url-row">
                  <input
                    id="dist-url-oh"
                    type="text"
                    className="sync-view__url-input"
                    value={ohUrl}
                    onChange={(e) => setOhUrl(e.target.value)}
                    placeholder="Paste URL..."
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

              <div className="sync-view__controls">
                <Button
                  onClick={saveDistributorUrls}
                  disabled={urlsSaving}
                  buttonStyle="secondary"
                  size="small"
                >
                  {urlsSaving ? 'Saving...' : 'Save URLs'}
                </Button>
              </div>

              {/* Progress Bar for PA/OH Import */}
              {dist.progress && <ImportProgress progress={dist.progress} />}

              {/* Live Details Feed */}
              {dist.logs.length > 0 && distImporting && <LogFeed logs={dist.logs} />}

              {/* Distributor Import Results */}
              {dist.results && (
                <ImportResultsBanner
                  title={`${dist.results.region} Import Results`}
                  isError={dist.results.errors > 0 && dist.results.imported === 0}
                  stats={[
                    { count: dist.results.imported, label: 'imported', pillStyle: 'success' },
                    { count: dist.results.skipped, label: 'skipped', pillStyle: 'light' },
                    {
                      count: dist.results.errors,
                      label: 'errors',
                      pillStyle: 'error',
                      hideWhenZero: true,
                    },
                  ]}
                  details={dist.results.details}
                />
              )}

              {/* Lake Beverage CSV Upload */}
              <div className="sync-view__subsection">
                <h3 className="sync-view__subsection-title">Lake Beverage (NY)</h3>
                <p className="sync-view__description sync-view__description--small">
                  Upload CSV with columns: Retail Accounts, Address, City, Account #, State, Zip
                  Code, Phone
                </p>

                <div className="sync-view__controls">
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

                {lake.progress && <ImportProgress progress={lake.progress} />}

                {lake.results && (
                  <ImportResultsBanner
                    title="NY Import Results"
                    isError={lake.results.errors > 0 && lake.results.imported === 0}
                    stats={[
                      { count: lake.results.imported, label: 'imported', pillStyle: 'success' },
                      { count: lake.results.skipped, label: 'skipped', pillStyle: 'light' },
                      {
                        count: lake.results.errors,
                        label: 'errors',
                        pillStyle: 'error',
                        hideWhenZero: true,
                      },
                    ]}
                    details={lake.results.details}
                  />
                )}
              </div>

              {/* Fix Bad Coordinates Section */}
              <div className="sync-view__subsection">
                <h3 className="sync-view__subsection-title">Fix Bad Coordinates</h3>
                <p className="sync-view__description sync-view__description--small">
                  Find and re-geocode distributors that have default/fallback coordinates
                  (Pittsburgh, Columbus, or Rochester center)
                </p>

                <div className="sync-view__controls">
                  <Button
                    onClick={handleRegeocodeDistributors}
                    disabled={regeocode.running}
                    buttonStyle={regeocodeDryRun ? 'secondary' : 'primary'}
                    size="small"
                  >
                    {regeocode.running
                      ? regeocodeDryRun
                        ? 'Scanning...'
                        : 'Fixing...'
                      : regeocodeDryRun
                        ? 'Find Bad Coords'
                        : 'Fix Bad Coords'}
                  </Button>
                  <CheckboxInput
                    id="regeocode-dry-run"
                    checked={regeocodeDryRun}
                    onToggle={(e) => setRegeocodeDryRun(e.target.checked)}
                    readOnly={regeocode.running}
                    label="Dry run (preview only)"
                  />
                </div>

                {regeocode.progress && <ImportProgress progress={regeocode.progress} />}

                {regeocode.logs.length > 0 && <LogFeed logs={regeocode.logs} />}

                {/* Results */}
                {regeocode.results && (
                  <div className="sync-view__banner-wrap">
                    <Banner
                      type={
                        regeocode.results.fixed > 0 || regeocode.results.suspicious === 0
                          ? 'success'
                          : 'info'
                      }
                    >
                      <div className="sync-view__banner-row">
                        <strong>{regeocodeDryRun ? 'Scan Results' : 'Fix Results'}</strong>
                        <Pill pillStyle="light">{regeocode.results.checked} checked</Pill>
                        <Pill pillStyle={regeocode.results.suspicious > 0 ? 'warning' : 'success'}>
                          {regeocode.results.suspicious} with bad coords
                        </Pill>
                        {!regeocodeDryRun && regeocode.results.fixed > 0 && (
                          <Pill pillStyle="success">{regeocode.results.fixed} fixed</Pill>
                        )}
                        {!regeocodeDryRun && regeocode.results.failed > 0 && (
                          <Pill pillStyle="error">{regeocode.results.failed} failed</Pill>
                        )}
                      </div>
                    </Banner>
                    {/* List of distributors with bad coords (dry run) */}
                    {regeocodeDryRun &&
                      regeocode.results.distributors &&
                      regeocode.results.distributors.length > 0 && (
                        <div className="sync-view__details">
                          {regeocode.results.distributors.map(
                            (dist_: RegeocodeDistributor, i: number) => (
                              <div key={i} className="sync-view__detail-entry">
                                <strong>{dist_.name}</strong>
                                <br />
                                <span className="sync-view__detail-line">
                                  Address:{' '}
                                  {dist_.address === '(missing)' ? (
                                    <span className="sync-view__missing">(missing)</span>
                                  ) : (
                                    dist_.address
                                  )}
                                </span>
                                <br />
                                <span className="sync-view__detail-line">
                                  City:{' '}
                                  {dist_.city === '(missing)' ? (
                                    <span className="sync-view__missing">(missing)</span>
                                  ) : (
                                    dist_.city
                                  )}
                                  , State:{' '}
                                  {dist_.state === '(missing)' ? (
                                    <span className="sync-view__missing">(missing)</span>
                                  ) : (
                                    dist_.state
                                  )}
                                  , Zip:{' '}
                                  {dist_.zip === '(missing)' ? (
                                    <span className="sync-view__missing">(missing)</span>
                                  ) : (
                                    dist_.zip
                                  )}
                                </span>
                                {dist_.fullAddress && (
                                  <>
                                    <br />
                                    <span className="sync-view__detail-note">
                                      Will geocode: &quot;{dist_.fullAddress}&quot;
                                    </span>
                                  </>
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Beer Utilities Section */}
        <div className="sync-view__section">
          <h2 className="sync-view__section-title">Beer Utilities</h2>
          <p className="sync-view__description">
            Recalculate auto-computed beer fields (Half Pour, Can Single prices)
          </p>

          <div className="sync-view__controls">
            <Button
              onClick={handleRecalculateBeerFields}
              disabled={recalc.running}
              buttonStyle={recalcDryRun ? 'secondary' : 'primary'}
              size="small"
            >
              {recalc.running
                ? recalcDryRun
                  ? 'Previewing...'
                  : 'Recalculating...'
                : recalcDryRun
                  ? 'Preview Recalculation'
                  : 'Recalculate All'}
            </Button>
            <CheckboxInput
              id="recalc-dry-run"
              checked={recalcDryRun}
              onToggle={(e) => setRecalcDryRun(e.target.checked)}
              readOnly={recalc.running}
              label="Dry run (preview only)"
            />
          </div>

          {/* Recalc Log Console */}
          {recalc.logs.length > 0 && (
            <div className="sync-view__console">
              <div className="sync-view__console-header">Console Output</div>
              <div className="sync-view__console-body sync-view__console-body--short">
                {recalc.logs.map((log) => (
                  <div
                    key={log.id}
                    className={`sync-view__feed-line sync-view__log-line--${logTone(log.type)}`}
                  >
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recalc Results */}
          {recalc.results && (
            <ImportResultsBanner
              title={recalcDryRun ? 'Preview Results' : 'Recalculation Complete'}
              isError={recalc.results.errors > 0}
              stats={[
                {
                  count: recalc.results.updated,
                  label: recalcDryRun ? 'would update' : 'updated',
                  pillStyle: 'success',
                },
                {
                  count: recalc.results.errors,
                  label: 'errors',
                  pillStyle: 'error',
                  hideWhenZero: true,
                },
              ]}
            />
          )}

          {/* Untappd Sync Section */}
          <div className="sync-view__subsection">
            <h3 className="sync-view__subsection-title">Sync Untappd Ratings</h3>
            <p className="sync-view__description sync-view__description--small">
              Bulk update Untappd ratings for all beers. Invalid URLs will be searched and fixed
              automatically.
            </p>

            <div className="sync-view__controls">
              <Button
                onClick={handleUntappdSync}
                disabled={untappd.running}
                buttonStyle={untappdDryRun ? 'secondary' : 'primary'}
                size="small"
              >
                {untappd.running
                  ? untappdDryRun
                    ? 'Previewing...'
                    : 'Syncing...'
                  : untappdDryRun
                    ? 'Preview Sync'
                    : 'Sync Now'}
              </Button>
              <CheckboxInput
                id="untappd-dry-run"
                checked={untappdDryRun}
                onToggle={(e) => setUntappdDryRun(e.target.checked)}
                readOnly={untappd.running}
                label="Dry run (preview only)"
              />
            </div>

            {untappd.progress && <ImportProgress progress={untappd.progress} />}

            {untappd.logs.length > 0 && <LogFeed logs={untappd.logs} tall />}

            {/* Results */}
            {untappd.results && (
              <ImportResultsBanner
                title={untappdDryRun ? 'Preview Results' : 'Sync Complete'}
                isError={untappd.results.errors > 0}
                stats={[
                  { count: untappd.results.total, label: 'total', pillStyle: 'light' },
                  { count: untappd.results.refreshed, label: 'refreshed', pillStyle: 'success' },
                  {
                    count: untappd.results.updated,
                    label: 'fixed',
                    pillStyle: 'warning',
                    hideWhenZero: true,
                  },
                  { count: untappd.results.skipped, label: 'skipped', pillStyle: 'light' },
                  {
                    count: untappd.results.errors,
                    label: 'errors',
                    pillStyle: 'error',
                    hideWhenZero: true,
                  },
                ]}
              />
            )}
          </div>
        </div>
      </div>
    </Gutter>
  )
}

/** Maps flow-specific log entry types onto the shared tone modifier classes */
const logTone = (type: string): string => {
  switch (type) {
    case 'refreshed':
    case 'success':
      return 'success'
    case 'updated':
    case 'new':
      return 'info'
    case 'multiple':
      return 'warning'
    case 'not-found':
      return 'muted'
    case 'error':
      return 'error'
    default:
      return 'default'
  }
}

/** Tone for a server-provided detail line (results panels) */
const detailTone = (detail: string): string => {
  if (detail.startsWith('Error')) return 'error'
  if (detail.startsWith('Imported') || detail.startsWith('Created')) return 'success'
  if (detail.startsWith('Warning')) return 'warning'
  return 'muted'
}

/** Progress bar for a streaming import */
const ImportProgress: React.FC<{ progress: ProgressData }> = ({ progress }) => (
  <div className="sync-view__progress">
    <div className="sync-view__progress-meta">
      <span className="sync-view__progress-name">{progress.name}</span>
      <span>
        {progress.current} / {progress.total} ({progress.percent}%)
      </span>
    </div>
    <div className="sync-view__progress-track">
      <div className="sync-view__progress-fill" style={{ width: `${progress.percent}%` }} />
    </div>
  </div>
)

/** Scrolling monospace feed of import log entries */
const LogFeed: React.FC<{ logs: ImportLogEntry[]; tall?: boolean }> = ({ logs, tall }) => (
  <div className={`sync-view__feed${tall ? ' sync-view__feed--tall' : ''}`}>
    {logs.map((log) => (
      <div
        key={log.id}
        className={`sync-view__feed-line sync-view__log-line--${logTone(log.type)}`}
      >
        {log.message}
      </div>
    ))}
  </div>
)

/** Results banner: status Banner with count Pills, optional detail lines below */
const ImportResultsBanner: React.FC<{
  title: string
  isError?: boolean
  stats: Array<{
    count: number
    label: string
    pillStyle: React.ComponentProps<typeof Pill>['pillStyle']
    hideWhenZero?: boolean
  }>
  details?: string[]
}> = ({ title, isError, stats, details }) => (
  <div className="sync-view__banner-wrap">
    <Banner type={isError ? 'error' : 'success'}>
      <div className="sync-view__banner-row">
        <strong>{title}</strong>
        {stats
          .filter((stat) => !(stat.hideWhenZero && stat.count === 0))
          .map((stat) => (
            <Pill key={stat.label} pillStyle={stat.pillStyle}>
              {stat.count} {stat.label}
            </Pill>
          ))}
      </div>
    </Banner>
    {details && details.length > 0 && (
      <div className="sync-view__details">
        {details.map((detail, i) => (
          <div key={i} className={`sync-view__feed-line sync-view__stat--${detailTone(detail)}`}>
            {detail}
          </div>
        ))}
      </div>
    )}
  </div>
)

export default SyncViewClient
