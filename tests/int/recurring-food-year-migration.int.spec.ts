import { describe, expect, it, vi } from 'vitest'
import {
  down,
  up,
} from '@/src/migrations/20260829_120000_scope_recurring_food_by_year'

function migrationArgs(collection: Record<string, unknown>) {
  return {
    payload: {
      db: {
        collections: {
          'recurring-food-schedules': { collection },
        },
      },
    },
  } as never
}

describe('recurring food year migration', () => {
  it('keeps a pre-created year index and removes the timeless unique index', async () => {
    const collection = {
      updateMany: vi.fn(),
      indexes: vi.fn(async () => [
        { name: 'location_1_day_1_occurrence_1', key: { location: 1, day: 1, occurrence: 1 } },
        {
          name: 'location_1_year_1_day_1_occurrence_1',
          key: { location: 1, year: 1, day: 1, occurrence: 1 },
        },
      ]),
      dropIndex: vi.fn(),
      createIndex: vi.fn(),
    }

    await up(migrationArgs(collection))

    expect(collection.updateMany).toHaveBeenCalledWith(
      { $or: [{ year: { $exists: false } }, { year: null }] },
      { $set: { year: 2026 } },
    )
    expect(collection.dropIndex).toHaveBeenCalledWith('location_1_day_1_occurrence_1')
    expect(collection.createIndex).not.toHaveBeenCalled()
  })

  it('creates the year index when Payload has not created it yet', async () => {
    const collection = {
      updateMany: vi.fn(),
      indexes: vi.fn(async () => []),
      dropIndex: vi.fn(),
      createIndex: vi.fn(),
    }

    await up(migrationArgs(collection))

    expect(collection.createIndex).toHaveBeenCalledWith(
      { location: 1, year: 1, day: 1, occurrence: 1 },
      { name: 'recurring_food_schedule_slot_by_year', unique: true },
    )
  })

  it('refuses a destructive rollback after another year has been authored', async () => {
    const collection = {
      findOne: vi.fn(async () => ({ year: 2027 })),
      indexes: vi.fn(),
      dropIndex: vi.fn(),
      updateMany: vi.fn(),
      createIndex: vi.fn(),
    }

    await expect(down(migrationArgs(collection))).rejects.toThrow(
      'Cannot remove year scoping after schedules for another year have been added',
    )
    expect(collection.updateMany).not.toHaveBeenCalled()
  })
})
