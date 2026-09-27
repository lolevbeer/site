/**
 * `payload run` imports a script and calls process.exit as soon as that import
 * settles. So scripts/reset-password.ts must end with a top-level
 * `await resetPassword()`. Without the await, the import settles at the first
 * `await getPayload(...)`, and every mode that touches the database exits 0
 * having done nothing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('scripts/reset-password.ts', () => {
  it('ends by awaiting resetPassword(), so payload run waits for it before exiting', () => {
    const source = fs.readFileSync(path.join(ROOT, 'scripts/reset-password.ts'), 'utf8')

    expect(source.trimEnd().split('\n').at(-1)).toBe('await resetPassword()')
  })
})
