/** Every registered production migration has explicit compatibility and recovery evidence. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { migrations } from '@/src/migrations'
import { migrationRecovery } from '@/src/migrations/recovery'

/** Payload's migrate CLI loads every sibling `.ts`/`.js` except `index.ts`/`index.js`. */
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/migrations')

describe('migration recovery manifest', () => {
  it('covers the migration registry in the same order', () => {
    expect(migrationRecovery.map(({ name }) => name)).toEqual(migrations.map(({ name }) => name))
  })

  it('contains actionable metadata for every migration', () => {
    for (const entry of migrationRecovery) {
      expect(entry.compatibility.trim().length).toBeGreaterThan(20)
      expect(entry.retry.trim().length).toBeGreaterThan(20)
      expect(entry.verify.trim().length).toBeGreaterThan(20)
      expect(['down', 'roll-forward', 'restore']).toContain(entry.mode)
    }
  })

  it('does not authorize batch migration down as production recovery', () => {
    expect(migrationRecovery.map(({ mode }) => mode)).not.toContain('down')
  })

  it('requires restore or a compatible roll-forward when Google Sheets fields break the live prior deployment', () => {
    const recovery = migrationRecovery.find(
      ({ name }) => name === '20260830_100000_drop_google_sheets_fields',
    )

    expect(recovery).toMatchObject({
      mode: 'restore',
      compatibility: expect.stringMatching(/prior deployment/i),
      verify: expect.stringMatching(/Atlas restore or immediate compatible roll-forward/i),
    })
  })

  it('requires safe index and write preconditions before retrying year scoping', () => {
    const recovery = migrationRecovery.find(
      ({ name }) => name === '20260829_120000_scope_recurring_food_by_year',
    )

    expect(recovery).toMatchObject({
      retry: expect.stringMatching(/quiesce.*writes/i),
      verify: expect.stringMatching(/duplicate.*location.*year.*day.*occurrence/i),
    })
  })

  it('does not place non-migration modules where Payload auto-discovers up functions', () => {
    const discovered = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(
        (name) =>
          (name.endsWith('.ts') || name.endsWith('.js')) &&
          name !== 'index.ts' &&
          name !== 'index.js',
      )
      .map((name) => name.split('.')[0])
      .sort()

    expect(discovered).toEqual([...migrations.map(({ name }) => name)].sort())
  })
})
