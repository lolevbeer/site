// @vitest-environment node
/**
 * Event `description` is an internal note: only signed-in staff read it, so
 * the public site, REST API, RSS, and JSON-LD never see it. `otherInfo` is
 * event-manager-read-only and is available on public events too.
 */
import { findPayloadField } from '../helpers/payload-fields'
import { describe, expect, it } from 'vitest'
import type { Field, FieldAccess } from 'payload'
import { eventDetailFields } from '@/src/collections/shared/event-fields'

const field = (name: string) =>
  findPayloadField(eventDetailFields, name) as Field & {
    admin?: { description?: string; condition?: unknown }
    access?: { read?: FieldAccess }
  }

const canRead = (name: string, user: unknown) =>
  field(name).access!.read!({ req: { user } } as Parameters<FieldAccess>[0])

describe('event detail fields', () => {
  it('keeps description internal: staff read it, the public does not', () => {
    expect(canRead('description', null)).toBe(false)
    expect(canRead('description', { id: 'u1', roles: ['bartender'] })).toBe(true)
    expect(field('description').admin?.description).toMatch(/internal/i)
  })

  it('offers the staff-only otherInfo note on public events too', () => {
    const otherInfo = field('otherInfo')
    expect(otherInfo.access?.read).toBeTypeOf('function')
    expect(otherInfo.admin?.condition).toBeUndefined()
  })
})
