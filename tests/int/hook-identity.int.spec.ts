/**
 * Hooks that look up related docs act for the editing user: each inner Local
 * API call must receive the hook's own `req` (user + save transaction) and an
 * explicit `overrideAccess: false` (an omitted flag defaults to false on Payload 4, true on Payload 3).
 */
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@/src/payload-types'
import { Menus } from '@/src/collections/Menus'
import { Food } from '@/src/collections/Food'
import { Jobs } from '@/src/collections/Jobs'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const bartender: User = {
  id: 'bartender-id',
  collection: 'users',
  email: 'bartender@example.com',
  roles: ['bartender'],
  locations: ['loc-1'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function mockReq(user: User) {
  return {
    user,
    context: {},
    payload: {
      findByID: vi.fn(async () => ({ id: 'x', name: 'Lawrenceville', slug: 'lawrenceville' })),
      find: vi.fn(async () => ({ docs: [{ id: 'beer-1', recipe: 12 }] })),
    },
  }
}

type AnyHook = (args: Record<string, unknown>) => unknown

describe('hook lookups act for the editing user', () => {
  it('Menus beforeChange passes req and overrideAccess: false to both lookups', async () => {
    const req = mockReq(bartender)
    const hook = Menus.hooks!.beforeChange![0] as unknown as AnyHook
    await hook({
      req,
      data: {
        location: 'loc-1',
        type: 'cans',
        items: [{ product: { relationTo: 'beers', value: 'beer-1' } }],
      },
    })

    expect(req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'locations', req, overrideAccess: false }),
    )
    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'beers', req, overrideAccess: false }),
    )
  })

  it('Food vendorName hook passes req and overrideAccess: false', async () => {
    const req = mockReq({ ...bartender, roles: ['food-manager'] as User['roles'] })
    const field = Food.fields.find((f) => 'name' in f && f.name === 'vendorName') as {
      hooks: { beforeChange: AnyHook[] }
    }
    await field.hooks.beforeChange[0]({ req, data: { vendor: 'vendor-1' } })

    expect(req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'food-vendors', req, overrideAccess: false }),
    )
  })

  it('Jobs afterChange location lookup passes req and overrideAccess: false', async () => {
    const req = mockReq({ ...bartender, roles: ['admin'] })
    const hook = Jobs.hooks!.afterChange![0] as unknown as AnyHook
    await hook({ req, context: {}, doc: { id: 'job-1', location: 'loc-1' } })

    expect(req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'locations', req, overrideAccess: false }),
    )
  })
})
