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
})
