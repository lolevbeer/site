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

function clickLink(href: string) {
  const { getByText, unmount } = render(
    <>
      <ConversionTracker />
      <a href={href} onClick={(e) => e.preventDefault()}>
        <span>link</span>
      </a>
    </>,
  )
  fireEvent.click(getByText('link'))
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
    expect(track).toHaveBeenCalledTimes(3)
    for (const call of track.mock.calls) {
      expect(call).toEqual(['directions', { page: window.location.pathname }])
    }
  })

  it('sends outbound with the host for other external links', () => {
    clickLink('https://untappd.com/b/lolev')
    expect(track).toHaveBeenCalledWith('outbound', { host: 'untappd.com' })
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
