// @vitest-environment node
/**
 * Regression coverage for the SSR-blank-paint fix: BlurFade (and
 * PageTransition, which delegates to it) must render at final, visible
 * styles in server HTML — no `opacity:0`/`filter:blur` — since that markup
 * is what ships before React hydrates and the mount effect flips `mounted`
 * to true. `useState`/`useEffect` never run during `renderToStaticMarkup`,
 * so this reproduces exactly what a real Next.js SSR pass produces.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { BlurFade, PageTransition } from '@/components/motion'

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
    // mounted guard must not touch it.
    const html = renderToStaticMarkup(
      createElement(BlurFade, { inView: true, children: createElement('h1', null, 'Hello') }),
    )

    expect(html).toMatch(/opacity:0\b/)
  })
})
