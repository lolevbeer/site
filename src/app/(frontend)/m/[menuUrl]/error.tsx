'use client'

/**
 * Error boundary for menu displays (/m/<id>).
 *
 * These screens run unattended on Frame TVs, so a transient failure — a Payload
 * cold start or DB blip, typically right after a deploy when every display
 * reloads at once — must self-recover without anyone touching the TV. Next
 * renders this (instead of caching a 404) whenever the page's data fetch throws;
 * see getMenuByUrlFresh. We report to Sentry, then reload after a short delay to
 * give the backend time to warm. If the outage persists the reload simply
 * retries every few seconds until the menu comes back — the correct behaviour
 * for an always-on display.
 */
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/** Delay before auto-reloading, giving a cold backend time to recover. */
const RETRY_DELAY_MS = 5000

export default function MenuError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
    const timer = setTimeout(() => window.location.reload(), RETRY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [error])

  // Neutral black holding screen — no human-facing controls on a TV.
  return <div style={{ height: '100vh', width: '100vw', background: '#000' }} />
}
