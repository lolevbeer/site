// @vitest-environment node
// Guards the browser Sentry config against re-adding the heavy replay and
// profiling integrations (rrweb + profiler, ~178KB gz) to every page.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  new URL('../../instrumentation-client.ts', import.meta.url),
  'utf8',
)

describe('instrumentation-client Sentry config', () => {
  it('does not ship replay or profiling integrations', () => {
    expect(source).not.toMatch(/replayIntegration/)
    expect(source).not.toMatch(/browserProfilingIntegration/)
    expect(source).not.toMatch(/replaysSessionSampleRate|replaysOnErrorSampleRate/)
    expect(source).not.toMatch(/profilesSampleRate/)
  })

  it('only enables Sentry in production when the DSN is set', () => {
    expect(source).toMatch(
      /enabled:\s*process\.env\.NODE_ENV === ["']production["'] && !!process\.env\.NEXT_PUBLIC_SENTRY_DSN/,
    )
  })

  it('exports onRouterTransitionStart synchronously at the top level', () => {
    expect(source).toMatch(
      /^export const onRouterTransitionStart = Sentry\.captureRouterTransitionStart;?$/m,
    )
  })
})
