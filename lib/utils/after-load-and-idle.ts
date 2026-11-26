/**
 * Defers heavy client-only work (three.js scenes) until the page has loaded
 * and the main thread is idle, so it never competes with the LCP image or
 * with hydration. Browser only: call it from an effect.
 */

/** Run `fn` once the page has loaded and the main thread is idle. Safari has
 *  no requestIdleCallback, so it falls back to a short timeout. Returns a
 *  cancel function. */
export function afterLoadAndIdle(fn: () => void): () => void {
  let cancelIdle = () => {}
  const schedule = () => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(fn, { timeout: 2000 })
      cancelIdle = () => window.cancelIdleCallback(id)
    } else {
      const id = setTimeout(fn, 200)
      cancelIdle = () => clearTimeout(id)
    }
  }
  if (document.readyState === 'complete') {
    schedule()
    return () => cancelIdle()
  }
  window.addEventListener('load', schedule, { once: true })
  return () => {
    window.removeEventListener('load', schedule)
    cancelIdle()
  }
}
