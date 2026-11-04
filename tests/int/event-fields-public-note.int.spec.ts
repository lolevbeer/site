// @vitest-environment node
/**
 * Event `description` is an internal note: only signed-in staff read it, so
 * the public site, REST API, RSS, and JSON-LD never see it. `otherInfo` is
 * event-manager-read-only and is available on public events too. `summary`
 * is the public counterpart to `description`: readable by everyone and shown
 * on the event page and in search results.
 */
import { findPayloadField } from '../helpers/payload-fields'
import { describe, expect, it } from 'vitest'
import type { Field, FieldAccess } from 'payload'
import { eventDetailFields } from '@/src/collections/shared/event-fields'

const field = (name: string) =>
  findPayloadField(eventDetailFields, name) as Field & {
    admin?: { description?: string; condition?: (data: unknown) => boolean }
    access?: { read?: FieldAccess }
    maxLength?: number
  }

const canRead = (name: string, user: unknown) =>
  field(name).access!.read!({ req: { user } } as Parameters<FieldAccess>[0])

describe('event detail fields', () => {
  it('keeps description internal: staff read it, the public does not', () => {
    expect(canRead('description', null)).toBe(false)
    expect(canRead('description', { id: 'u1', roles: ['bartender'] })).toBe(true)
    expect(field('description').admin?.description).toMatch(/internal/i)
  })

  it('offers a publicly readable summary capped at 300 characters', () => {
    const summary = field('summary')
    expect(summary.access?.read).toBeUndefined()
    expect(summary.maxLength).toBe(300)
  })

  it('hides summary on private events and shows it on public ones', () => {
    const condition = field('summary').admin!.condition!
    expect(condition({ visibility: 'private' })).toBe(false)
    expect(condition({ visibility: 'public' })).toBe(true)
  })

  it('offers the staff-only otherInfo note on public events too', () => {
    const otherInfo = field('otherInfo')
    expect(otherInfo.access?.read).toBeTypeOf('function')
    expect(otherInfo.admin?.condition).toBeUndefined()
  })
})
