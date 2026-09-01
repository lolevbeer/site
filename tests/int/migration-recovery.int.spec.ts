/** Every registered production migration has explicit compatibility and recovery evidence. */
import { describe, expect, it } from 'vitest'
import { migrations } from '@/src/migrations'
import { migrationRecovery } from '@/src/migrations/recovery'

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
})
