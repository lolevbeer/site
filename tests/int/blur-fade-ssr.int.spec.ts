/**
 * Regression coverage for the SSR-blank-paint fix, and for the review round 1
 * finding that a per-instance "mounted" flag would permanently kill the
 * entrance animation on client-side route navigation.
 *
 * BlurFade (and PageTransition, which delegates to it) must:
 *  - render at final, visible styles in server HTML — no `opacity:0` /
 *    `filter:blur` — since that markup is what ships before React hydrates;
 *  - still animate in from hidden on every later mount, including ones
 *    created well after the app's first hydration (e.g. App Router swapping
 *    in a fresh PageTransition/BlurFade tree on a client-side route change).
 *
 * The SSR assertions use `renderToStaticMarkup`, which never runs effects,
 * so it reproduces exactly what a real Next.js SSR pass produces. The
 * hydration-propagation assertions use `@testing-library/react` (jsdom) to
 * actually mount/unmount instances and flip the module-level hydration flag,
 * via the test-only `__resetBlurFadeHydrationForTests` reset hook.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { render, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { BlurFade, PageTransition } from '@/components/motion'
import { __resetBlurFadeHydrationForTests } from '@/components/motion/blur-fade'

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
      createElement(BlurFade, { inView: true, children: createElement('h1', null, 'Hello') }),
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
      createElement(BlurFade, { children: createElement('h1', null, 'A') }),
    )

    expect(container.innerHTML).not.toMatch(/opacity:\s*0\b/)
  })

  it('a later mount — e.g. a client-side route navigation — still animates in from hidden', () => {
    // Mount and unmount one instance so its effect flips the module-level
    // hydration flag, simulating "the app has already hydrated once".
    const first = render(createElement(BlurFade, { children: createElement('h1', null, 'A') }))
    first.unmount()

    // A fresh BlurFade tree — e.g. App Router mounting a new
    // PageTransition/BlurFade on navigation — must animate in, not render
    // pre-animated, on this later mount too.
    const { container } = render(
      createElement(BlurFade, { children: createElement('h1', null, 'B') }),
    )

    expect(container.innerHTML).toMatch(/opacity:\s*0\b/)
  })
})
