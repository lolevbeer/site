// @vitest-environment node
// All three Sentry configs init from sentry.options.ts, which must not grow the
// heavy replay/profiling integrations (~178KB gz on the client) or Sentry logs,
// and stays gated on production + a DSN. On the client the SDK itself must stay
// out of the shared bundle: it is loaded on demand (instrumentation-client.ts,
// lib/utils/report-error.ts) through lib/utils/sentry-sdk.ts, the one module
// allowed to import the package, so the lazy chunk is tree-shaken.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sentryOptions } from '../../sentry.options'

const root = new URL('../../', import.meta.url)
const read = (file: string) => readFileSync(new URL(file, root), 'utf8')

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
  const source = read('instrumentation-client.ts')

  it('loads the SDK with a dynamic import, gated on sentryOptions.enabled', () => {
    expect(source).toMatch(/if \(sentryOptions\.enabled\)[\s\S]*import\('\.\/lib\/utils\/sentry-sdk'\)/)
    expect(source).not.toMatch(/^import \* as Sentry/m)
  })

  it('exports onRouterTransitionStart synchronously at the top level', () => {
    expect(source).toMatch(/^export const onRouterTransitionStart\b/m)
  })
})

/** Every .ts/.tsx file under dir, recursively. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

describe('client bundles', () => {
  it('never import @sentry/nextjs outside lib/utils/sentry-sdk.ts', () => {
    const base = root.pathname
    const offenders = ['components', 'lib', 'src/app']
      .flatMap((dir) => walk(join(base, dir)))
      .filter((file) => !/\.(test|spec)\.tsx?$/.test(file) && !file.endsWith('lib/utils/sentry-sdk.ts'))
      .filter((file) => /^(import|export) (?!type\b)[^;]*from ['"]@sentry\/nextjs['"]/m.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(base.length))
    expect(offenders).toEqual([])
  })
})
