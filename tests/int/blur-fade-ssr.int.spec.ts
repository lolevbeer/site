/**
 * BlurFade (and PageTransition, which delegates to it) must render at final,
 * visible styles in server HTML — that markup ships before React hydrates, so
 * any `opacity:0` there is a blank first paint — yet still animate in from
 * hidden on mounts created after hydration, e.g. App Router swapping in a
 * fresh tree on a client-side route change.
 *
 * `renderToStaticMarkup` never runs effects, so it reproduces a real SSR pass;
 * the hydration cases use jsdom to actually commit components and flip the
 * module-level flag, reset between cases via `__resetBlurFadeHydrationForTests`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { render, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { BlurFade, PageTransition } from '@/components/motion'
import {
  __resetBlurFadeHydrationForTests,
  MotionHydrationSentinel,
} from '@/components/motion/blur-fade'

describe('BlurFade / PageTransition SSR output', () => {
  it('BlurFade renders visible (no opacity:0) before the client has mounted', () => {
    const html = renderToStaticMarkup(
      createElement(BlurFade, null, createElement('h1', null, 'Hello')),
    )

    expect(html).not.toMatch(/opacity:0\b/)
    expect(html).not.toMatch(/filter:blur\((?!0px)/)
  })

  it('PageTransition (delegates to BlurFade) renders visible before mount', () => {
    const html = renderToStaticMarkup(
      createElement(PageTransition, null, createElement('h1', null, 'Hello')),
    )

    expect(html).not.toMatch(/opacity:0\b/)
    expect(html).not.toMatch(/filter:blur\((?!0px)/)
  })

  it('scroll-triggered BlurFade (inView) is unaffected and still starts hidden', () => {
    // Scroll-reveal content is intentionally hidden until scrolled into
    // view — it isn't part of the first-paint blank-page problem, so the
    // hydration guard must not touch it.
    const html = renderToStaticMarkup(
      createElement(BlurFade, { inView: true }, createElement('h1', null, 'Hello')),
    )

    expect(html).toMatch(/opacity:0\b/)
  })
})

describe('BlurFade hydration-flag propagation across mounts', () => {
  afterEach(() => {
    cleanup()
    __resetBlurFadeHydrationForTests()
  })

  it('the first instance to hydrate matches SSR: no opacity:0 on its first commit', () => {
    const { container } = render(
      createElement(BlurFade, null, createElement('h1', null, 'A')),
    )

    expect(container.innerHTML).not.toMatch(/opacity:\s*0\b/)
  })

  it('after the sentinel commits, a later mount still animates in from hidden', () => {
    // The sentinel is the only writer of the flag, and it lives in the root
    // layout — so this covers hard-loading a page with NO BlurFade (/privacy,
    // /terms, /beer-map) and then client-navigating: the destination tree must
    // animate in, not render pre-animated.
    render(createElement(MotionHydrationSentinel))

    const { container } = render(
      createElement(BlurFade, null, createElement('h1', null, 'B')),
    )

    expect(container.innerHTML).toMatch(/opacity:\s*0\b/)
  })

  it('without the sentinel, a BlurFade mount does not flip the flag for later mounts', () => {
    // Guards the single-writer invariant: BlurFade deliberately no longer sets
    // the flag itself, so a tree mounted outside the root layout keeps painting
    // at SSR-visible styles rather than silently animating.
    render(createElement(BlurFade, null, createElement('h1', null, 'A'))).unmount()

    const { container } = render(
      createElement(BlurFade, null, createElement('h1', null, 'B')),
    )

    expect(container.innerHTML).not.toMatch(/opacity:\s*0\b/)
  })
})
