/**
 * pnpm-workspace.yaml pins mongoose exactly so the graph holds one copy. That
 * pin must equal @payloadcms/db-mongodb's own mongoose pin: an override
 * replaces the adapter's dependency too, so after a Payload upgrade that moves
 * the adapter's pin, a stale override would silently run the adapter on a
 * mongoose version it was never released with.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('mongoose override', () => {
  it("matches @payloadcms/db-mongodb's pinned mongoose version", () => {
    const workspace = fs.readFileSync(path.join(ROOT, 'pnpm-workspace.yaml'), 'utf8')
    const override = workspace.match(/^\s*"mongoose":\s*"([^"]+)"/m)?.[1]
    const adapter = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'node_modules/@payloadcms/db-mongodb/package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> }

    expect(override).toBe(adapter.dependencies.mongoose)
  })
})
