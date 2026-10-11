'use client'

/**
 * One delegated document listener that reports taproom-driving link clicks
 * (plain clicks and middle-click "open in new tab"): `tel:` links send `call`,
 * Google/Apple Maps links (including Google's maps.app.goo.gl and goo.gl/maps
 * share links) send `directions` with the current page, and any other off-site
 * link sends `outbound` with its host. Mounted once in the frontend layout;
 * renders nothing.
 */

import { useEffect } from 'react'
import { trackConversion } from '@/lib/analytics/events'

function isMapsUrl(url: URL): boolean {
  const host = url.hostname
  if (host === 'maps.apple.com' || host === 'maps.google.com' || host === 'maps.app.goo.gl') {
    return true
  }
  const isGoogle = host === 'google.com' || host.endsWith('.google.com')
  return (isGoogle || host === 'goo.gl') && url.pathname.startsWith('/maps')
}

function trackLinkClick(event: MouseEvent) {
  // auxclick also fires for right-click; only the middle button opens the link.
  if (event.type === 'auxclick' && event.button !== 1) return
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
    document.addEventListener('auxclick', trackLinkClick)
    return () => {
      document.removeEventListener('click', trackLinkClick)
      document.removeEventListener('auxclick', trackLinkClick)
    }
  }, [])
  return null
}
