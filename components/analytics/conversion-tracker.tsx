'use client'

/**
 * One delegated document click listener that reports taproom-driving link
 * clicks: `tel:` links send `call`, Google/Apple Maps links send `directions`
 * with the current page, and any other off-site link sends `outbound` with its
 * host. Mounted once in the frontend layout; renders nothing.
 */

import { useEffect } from 'react'
import { trackConversion } from '@/lib/analytics/events'

function isMapsUrl(url: URL): boolean {
  if (url.hostname === 'maps.apple.com' || url.hostname === 'maps.google.com') return true
  return url.hostname.endsWith('google.com') && url.pathname.startsWith('/maps')
}

function trackLinkClick(event: MouseEvent) {
  const link = (event.target as Element | null)?.closest?.('a[href]')
  if (!link) return
  const href = link.getAttribute('href') ?? ''
  if (href.startsWith('tel:')) return trackConversion('call')

  let url: URL
  try {
    url = new URL(href, window.location.href)
  } catch {
    return
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return
  if (isMapsUrl(url)) return trackConversion('directions', { page: window.location.pathname })
  if (url.origin !== window.location.origin) trackConversion('outbound', { host: url.hostname })
}

export function ConversionTracker() {
  useEffect(() => {
    document.addEventListener('click', trackLinkClick)
    return () => document.removeEventListener('click', trackLinkClick)
  }, [])
  return null
}
