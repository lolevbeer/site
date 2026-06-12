'use client'

/**
 * Shared state + lifecycle for admin import/sync tools driven by Server-Sent Events.
 *
 * Every import flow in the admin Sync view follows the same shape:
 *   reset state → POST fetch → branch on SSE vs JSON response →
 *   parseSSEStream with handlers → catch network errors → cleanup.
 *
 * This hook owns that lifecycle plus the four pieces of state each flow
 * duplicates (running, progress, logs, results), so a flow only supplies
 * what is unique to it: the endpoint, how to read its `complete` payload,
 * and any event handlers beyond the defaults.
 *
 * Default SSE handlers (each can be overridden per flow):
 * - `status`   → appends a 'status' log entry from `data.message`
 * - `progress` → updates `progress` with the ProgressData payload
 * - `error`    → appends an 'error' log entry from `data.message`
 * - `complete` → stores `getResults(data)` into `results`
 *
 * Non-SSE responses (JSON errors, or JSON success fallbacks like the
 * re-geocode dry run) are routed to `onJSON`; unhandled ones become an
 * 'error' log entry. Thrown fetch/stream errors go to `onException` with
 * the same fallback.
 */

import { useCallback, useRef, useState } from 'react'

import { parseSSEStream, isSSEResponse, type SSEHandlers } from '@/lib/utils/sse-parser'

/** Parsed JSON payload of a single SSE event */
export type SSEData = Record<string, unknown>

/** Payload of `progress` events emitted by the import endpoints */
export interface ProgressData {
  current: number
  total: number
  name: string
  percent: number
}

/** One entry in an import flow's log console */
export interface ImportLogEntry {
  id: number
  /** Flow-defined category that drives rendering (e.g. 'status', 'error', 'beer') */
  type: string
  message: string
  timestamp: Date
  /** Optional structured payload attached to the entry (e.g. field changes) */
  data?: unknown
}

/** State setters handed to flow-specific callbacks */
export interface SSEImportHelpers<TResults> {
  appendLog: (type: string, message: string, data?: unknown) => void
  setProgress: (progress: ProgressData | null) => void
  setResults: (results: TResults | null) => void
}

export interface UseSSEImportOptions<TResults> {
  /** Extract this flow's results from the SSE `complete` event payload */
  getResults?: (data: SSEData) => TResults | null
  /** Flow-specific SSE handlers, merged over the defaults described above */
  handlers?: (helpers: SSEImportHelpers<TResults>) => SSEHandlers
  /**
   * Handle non-SSE (JSON) responses — error payloads, or JSON success
   * fallbacks. Check `response.ok` to distinguish. Defaults to logging
   * `data.error` (or the HTTP status) as an 'error' entry.
   */
  onJSON?: (data: SSEData, response: Response, helpers: SSEImportHelpers<TResults>) => void
  /** Handle thrown fetch/stream errors. Defaults to an 'error' log entry. */
  onException?: (error: unknown, helpers: SSEImportHelpers<TResults>) => void
  /** Maximum log entries retained (default 100; pass Infinity for unbounded) */
  logLimit?: number
}

export interface SSEImportRunOptions<TResults>
  extends Pick<UseSSEImportOptions<TResults>, 'getResults' | 'handlers' | 'onJSON' | 'onException'> {
  /** Request body (e.g. FormData for CSV uploads) */
  body?: BodyInit
}

export function useSSEImport<TResults>(options: UseSSEImportOptions<TResults> = {}) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [logs, setLogs] = useState<ImportLogEntry[]>([])
  const [results, setResults] = useState<TResults | null>(null)
  const logIdRef = useRef(0)

  // Read options through a ref so `run` stays stable and never closes over
  // stale handlers from a previous render.
  const optionsRef = useRef(options)
  optionsRef.current = options

  const appendLog = useCallback((type: string, message: string, data?: unknown) => {
    const logLimit = optionsRef.current.logLimit ?? 100
    setLogs(prev => {
      const next = [...prev, { id: logIdRef.current++, type, message, timestamp: new Date(), data }]
      return next.length > logLimit ? next.slice(next.length - logLimit) : next
    })
  }, [])

  const run = useCallback(
    async (url: string, runOptions: SSEImportRunOptions<TResults> = {}) => {
      const opts = { ...optionsRef.current, ...runOptions }
      const helpers: SSEImportHelpers<TResults> = { appendLog, setProgress, setResults }

      setRunning(true)
      setProgress(null)
      setResults(null)
      setLogs([])
      logIdRef.current = 0

      try {
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          body: runOptions.body,
        })

        if (!isSSEResponse(response)) {
          const data: SSEData = await response.json().catch(() => ({}))
          if (opts.onJSON) {
            opts.onJSON(data, response, helpers)
          } else {
            appendLog('error', `Error: ${data.error || `HTTP ${response.status}`}`)
          }
          return
        }

        const defaultHandlers: SSEHandlers = {
          status: raw => appendLog('status', String((raw as SSEData).message ?? '')),
          progress: raw => setProgress(raw as ProgressData),
          error: raw => appendLog('error', `Error: ${(raw as SSEData).message ?? 'Unknown error'}`),
          complete: raw => {
            if (opts.getResults) setResults(opts.getResults(raw as SSEData))
          },
        }

        await parseSSEStream(response, {
          ...defaultHandlers,
          ...opts.handlers?.(helpers),
        })
      } catch (error: unknown) {
        if (opts.onException) {
          opts.onException(error, helpers)
        } else {
          appendLog('error', `Error: ${error instanceof Error ? error.message : 'Request failed'}`)
        }
      } finally {
        setRunning(false)
        setProgress(null)
      }
    },
    [appendLog],
  )

  // setResults is exposed for flows that surface validation errors as a
  // results payload without making a request (e.g. "no URL configured").
  return { running, progress, logs, results, run, appendLog, setResults }
}
