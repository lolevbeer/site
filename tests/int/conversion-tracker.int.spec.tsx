/** ConversionTracker: one delegated click listener sends call / directions / outbound events. */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const track = vi.fn()
vi.mock('@vercel/analytics', () => ({ track: (...args: unknown[]) => track(...args) }))

import { ConversionTracker } from '@/components/analytics/conversion-tracker'

const gtag = vi.fn()

beforeEach(() => {
  track.mockReset()
  gtag.mockReset()
  window.gtag = gtag
})
afterEach(() => {
  cleanup()
  delete window.gtag
})

function clickLink(href: string, event: 'click' | 'auxclick' = 'click') {
  const { getByText, unmount } = render(
    <>
      <ConversionTracker />
      <a href={href} onClick={(e) => e.preventDefault()}>
        <span>link</span>
      </a>
    </>,
  )
  if (event === 'click') fireEvent.click(getByText('link'))
  else fireEvent(getByText('link'), new MouseEvent('auxclick', { bubbles: true, button: 1 }))
  unmount()
}

describe('ConversionTracker', () => {
  it('sends call for tel: links, to Vercel and GA', () => {
    clickLink('tel:+14125551234')
    expect(track).toHaveBeenCalledWith('call', undefined)
    expect(gtag).toHaveBeenCalledWith('event', 'call', undefined)
  })

  it('sends directions with the current page for Google and Apple Maps links', () => {
    clickLink('https://www.google.com/maps/dir/?api=1&destination=1,2')
    clickLink('https://maps.google.com/?q=x')
    clickLink('https://maps.apple.com/?q=x')
    clickLink('https://maps.app.goo.gl/abc123')
    clickLink('https://goo.gl/maps/abc123')
    expect(track).toHaveBeenCalledTimes(5)
    for (const call of track.mock.calls) {
      expect(call).toEqual(['directions', { page: window.location.pathname }])
    }
  })

  it('sends outbound with the host for other external links', () => {
    clickLink('https://untappd.com/b/lolev')
    expect(track).toHaveBeenCalledWith('outbound', { host: 'untappd.com' })
  })

  it('treats look-alike hosts and non-maps goo.gl links as outbound', () => {
    clickLink('https://notgoogle.com/maps')
    clickLink('https://goo.gl/abc123')
    expect(track.mock.calls).toEqual([
      ['outbound', { host: 'notgoogle.com' }],
      ['outbound', { host: 'goo.gl' }],
    ])
  })

  it('counts middle-click (open in new tab) but not other aux buttons', () => {
    clickLink('tel:+14125551234', 'auxclick')
    const { getByText, unmount } = render(
      <>
        <ConversionTracker />
        <a href="tel:+1" onContextMenu={(e) => e.preventDefault()}>
          right
        </a>
      </>,
    )
    fireEvent(getByText('right'), new MouseEvent('auxclick', { bubbles: true, button: 2 }))
    unmount()
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('call', undefined)
  })

  it('ignores mailto: and other non-http links', () => {
    clickLink('mailto:x@y.com')
    clickLink('javascript:void(0)')
    expect(track).not.toHaveBeenCalled()
  })

  it('ignores same-site links and non-link clicks', () => {
    clickLink('/beer')
    clickLink(`${window.location.origin}/events`)
    const { getByText } = render(
      <>
        <ConversionTracker />
        <button>plain</button>
      </>,
    )
    fireEvent.click(getByText('plain'))
    expect(track).not.toHaveBeenCalled()
  })
})
