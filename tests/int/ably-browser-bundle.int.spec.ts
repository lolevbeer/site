// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { Script } from 'node:vm'
import { loadBindings, transform } from 'next/dist/build/swc'
import { expect, it } from 'vitest'

// The kiosk client imports `ably/modular`; `ably.js` is the default browser
// build. The patch (patches/ably@2.29.0.patch) must cover both.
const BROWSER_BUILDS = [
  { name: 'ably.js', isModule: false },
  { name: 'modular/index.mjs', isModule: true },
]

it.each(BROWSER_BUILDS)(
  'keeps the Ably browser bundle $name valid after Next compiles it for supported browsers',
  async ({ name, isModule }) => {
    const require = createRequire(import.meta.url)
    const filename = path.join(path.dirname(require.resolve('ably')), name)
    const source = readFileSync(filename, 'utf8')
    const { browserslist } = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    )

    await loadBindings()
    const { code } = await transform(source, {
      filename,
      isModule,
      jsc: { parser: { syntax: 'ecmascript' } },
      env: { targets: browserslist },
      // CommonJS output lets vm.Script parse the ES module; the lowering being
      // checked is the same one Next applies to the ESM bundle.
      ...(isModule ? { module: { type: 'commonjs' } } : {}),
    })

    // Without the Ably patch, SWC lowers the rest-argument arrow into a regular
    // function containing super(), which is a syntax error before the SDK loads.
    expect(() => new Script(code)).not.toThrow()
  },
)
