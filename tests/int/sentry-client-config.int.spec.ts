// @vitest-environment node
// Guards the Sentry configs against re-adding the heavy replay and profiling
// integrations (rrweb + profiler, ~178KB gz on the client) or the noisy
// logging options, and keeps all three gated on production + a DSN.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')

describe.each(['instrumentation-client.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts'])(
  '%s',
  (file) => {
    // Comments may explain why replay is gone; only code counts.
    const source = read(file).replace(/\/\/.*$/gm, '')

    it('does not configure replay, profiling, or Sentry logs', () => {
      expect(source).not.toMatch(/replay|profil/i)
      expect(source).not.toMatch(/enableLogs|consoleLoggingIntegration/)
    })

    it('only enables Sentry in production when the DSN is set', () => {
      expect(source).toMatch(
        /enabled:\s*process\.env\.NODE_ENV === ["']production["']\s*&&\s*!!process\.env\.NEXT_PUBLIC_SENTRY_DSN/,
      )
    })
  },
)

describe('instrumentation-client.ts', () => {
  it('exports onRouterTransitionStart synchronously at the top level', () => {
    expect(read('instrumentation-client.ts')).toMatch(
      /^export const onRouterTransitionStart = Sentry\.captureRouterTransitionStart;?$/m,
    )
  })
})
