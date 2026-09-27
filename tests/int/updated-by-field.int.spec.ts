/** Checks the `updatedBy` field stamps each save (and so each version) with its editor. */
import { describe, expect, it } from 'vitest'
import type { FieldHook, RelationshipField } from 'payload'
import { updatedByField } from '@/src/collections/utils/updatedByField'
import { Beers } from '@/src/collections/Beers'
import { Menus } from '@/src/collections/Menus'

const field = updatedByField as RelationshipField
const stamp = (user: { id: string } | null, value?: string) =>
  (field.hooks!.beforeChange![0] as FieldHook)({ req: { user }, value } as never)

describe('updatedByField', () => {
  it('records the signed-in editor, ignoring the submitted value', () => {
    expect(stamp({ id: 'editor' }, 'someone-else')).toBe('editor')
  })

  it('keeps the previous editor on user-less system saves', () => {
    expect(stamp(null, 'editor')).toBe('editor')
  })

  it('hides the editor from anonymous readers', () => {
    const read = field.access!.read!
    expect(read({ req: { user: null } } as never)).toBe(false)
    expect(read({ req: { user: { id: 'editor' } } } as never)).toBe(true)
  })

  it('is on Beers and Menus', () => {
    for (const collection of [Beers, Menus]) {
      expect(collection.fields).toContain(updatedByField)
    }
  })
})
