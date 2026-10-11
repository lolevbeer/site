// @vitest-environment node
// All three Sentry configs init from sentry.options.ts, which must not grow the
// heavy replay/profiling integrations (~178KB gz on the client) or Sentry logs,
// and stays gated on production + a DSN.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sentryOptions } from '../../sentry.options'

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')

describe.each(['instrumentation-client.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts'])(
  '%s',
  (file) => {
    it('initializes from the shared sentry.options', () => {
      expect(read(file)).toMatch(/Sentry\.init\(sentryOptions\)/)
    })
  },
)

describe('sentryOptions', () => {
  // The object is the config: no integrations (replay, profiling, console
  // logging) and no Sentry logs, and off outside production or without a DSN.
  it('sets only dsn, tracing, and the enable gate', () => {
    expect(Object.keys(sentryOptions).sort()).toEqual(['dsn', 'enabled', 'tracesSampleRate'])
  })

  it('is off outside production', () => {
    expect(sentryOptions.enabled).toBe(false)
  })
})

describe('instrumentation-client.ts', () => {
  it('exports onRouterTransitionStart synchronously at the top level', () => {
    expect(read('instrumentation-client.ts')).toMatch(
      /^export const onRouterTransitionStart = Sentry\.captureRouterTransitionStart;?$/m,
    )
  })
})
