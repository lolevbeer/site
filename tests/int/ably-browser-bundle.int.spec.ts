// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { Script } from 'node:vm'
import { loadBindings, transform } from 'next/dist/build/swc'
import { expect, it } from 'vitest'

it('keeps the Ably browser bundle valid after Next compiles it for supported browsers', async () => {
  const require = createRequire(import.meta.url)
  const filename = path.join(path.dirname(require.resolve('ably')), 'ably.js')
  const source = readFileSync(filename, 'utf8')
  const { browserslist } = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  )

  await loadBindings()
  const { code } = await transform(source, {
    filename,
    isModule: false,
    jsc: { parser: { syntax: 'ecmascript' } },
    env: { targets: browserslist },
  })

  // Without the Ably patch, SWC lowers the rest-argument arrow into a regular
  // function containing super(), which is a syntax error before the SDK loads.
  expect(() => new Script(code)).not.toThrow()
})
