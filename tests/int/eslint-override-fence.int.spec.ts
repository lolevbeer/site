// @vitest-environment node
/**
 * Guards the ESLint identity fence in eslint.config.mjs: `overrideAccess: true`
 * is only allowed in allowlisted system paths, and every Payload Local API call
 * must state `overrideAccess` explicitly (see AGENTS.md, Access control).
 */
import path from 'node:path'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

const cwd = path.resolve(__dirname, '../..')
let eslint: ESLint

async function fenceErrors(code: string, file: string) {
  const [result] = await eslint.lintText(code, { filePath: path.join(cwd, file) })
  return result.messages.filter((m) => m.ruleId === 'no-restricted-syntax' && m.severity === 2)
}

const systemTrue = `export const q = (payload: any) =>
  payload.find({ collection: 'x', overrideAccess: true })
`
const omitted = `export const q = (payload: any) => payload.find({ collection: 'x' })
`

describe('ESLint overrideAccess fence', () => {
  beforeAll(() => {
    eslint = new ESLint({ cwd })
  })

  it('rejects overrideAccess: true outside the allowlist', async () => {
    expect(await fenceErrors(systemTrue, 'lib/x.ts')).toHaveLength(1)
  }, 60_000)

  it('allows overrideAccess: true in migrations', async () => {
    expect(await fenceErrors(systemTrue, 'src/migrations/x.ts')).toHaveLength(0)
  }, 60_000)

  it('rejects a Local API call that omits overrideAccess', async () => {
    expect(await fenceErrors(omitted, 'lib/x.ts')).toHaveLength(1)
  }, 60_000)

  it('rejects an omitted overrideAccess even in allowlisted files', async () => {
    expect(await fenceErrors(omitted, 'src/migrations/x.ts')).toHaveLength(1)
  }, 60_000)

  it('accepts a call that follows access with the caller identity', async () => {
    const code = `export const q = (req: any, id: string) =>
  req.payload.findByID({ collection: 'x', id, overrideAccess: false, req })
`
    expect(await fenceErrors(code, 'lib/x.ts')).toHaveLength(0)
  }, 60_000)

  it('ignores auth calls', async () => {
    const code = `export const q = (payload: any, headers: Headers) => payload.auth({ headers })
`
    expect(await fenceErrors(code, 'lib/x.ts')).toHaveLength(0)
  }, 60_000)

  it('accepts an inline-fenced system call with a reason', async () => {
    const code = `export const q = (payload: any) =>
  // eslint-disable-next-line no-restricted-syntax -- system: test fixture
  payload.find({ collection: 'x', overrideAccess: true })
`
    const [result] = await eslint.lintText(code, { filePath: path.join(cwd, 'lib/x.ts') })
    expect(result.messages.filter((m) => m.severity === 2)).toHaveLength(0)
  }, 60_000)
})
