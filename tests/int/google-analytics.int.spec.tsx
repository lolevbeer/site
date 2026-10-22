/**
 * The GA loader must keep gtag.js out of the initial load (it is the single
 * largest third-party cost on the site) while still queueing anything tracked
 * before it arrives, and must keep Google signals off so no third-party
 * DoubleClick cookie is set on page view.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GA_ID, GA_LOADER, GoogleAnalytics } from '@/components/analytics/google-analytics'

const gtagScripts = () =>
  Array.from(document.querySelectorAll('script')).filter((s) =>
    s.src.startsWith('https://www.googletagmanager.com/gtag/js'),
  )

describe('GoogleAnalytics', () => {
  afterEach(() => {
    document.head.innerHTML = ''
    delete (window as { dataLayer?: unknown }).dataLayer
    delete (window as { gtag?: unknown }).gtag
  })

  it('renders only the inline loader, never the gtag.js script tag', () => {
    const html = renderToStaticMarkup(<GoogleAnalytics />)
    expect(html).toContain('allow_google_signals:false')
    expect(html).toContain('allow_ad_personalization_signals:false')
    expect(html).not.toMatch(/<script[^>]*src=/)
  })

  it('queues config immediately and loads gtag.js once, on first input', () => {
    new Function(GA_LOADER)()

    expect(typeof window.gtag).toBe('function')
    const queued = window.dataLayer as unknown as IArguments[]
    expect(queued).toHaveLength(2)
    expect(Array.from(queued[1])).toEqual([
      'config',
      GA_ID,
      { allow_google_signals: false, allow_ad_personalization_signals: false },
    ])
    expect(gtagScripts()).toHaveLength(0)

    window.gtag!('event', 'call')
    expect(queued).toHaveLength(3)

    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('scroll'))
    const scripts = gtagScripts()
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`)
    expect(scripts[0].async).toBe(true)
  })
})
