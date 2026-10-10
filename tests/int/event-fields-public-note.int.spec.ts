// @vitest-environment node
/**
 * Event `description` is published on /events and in Event JSON-LD, so staff
 * notes (billing, gratuity) must have a staff-only home on public events too:
 * `otherInfo` is event-manager-read-only and must not be hidden behind
 * visibility === 'private'.
 */
import { describe, expect, it } from 'vitest'
import type { Field } from 'payload'
import { eventDetailFields } from '@/src/collections/shared/event-fields'

const field = (name: string) =>
  eventDetailFields.find((f) => 'name' in f && f.name === name) as Field & {
    admin?: { description?: string; condition?: unknown }
    access?: { read?: unknown }
  }

describe('event detail fields', () => {
  it('warns editors that description is shown publicly', () => {
    expect(field('description').admin?.description).toMatch(/public/i)
  })

  it('offers the staff-only otherInfo note on public events too', () => {
    const otherInfo = field('otherInfo')
    expect(otherInfo.access?.read).toBeTypeOf('function')
    expect(otherInfo.admin?.condition).toBeUndefined()
  })
})
