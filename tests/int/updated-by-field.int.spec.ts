/** Checks `updatedBy` ("Last edited by") records the last signed-in editor on each save, and so on each version. */
import { describe, expect, it } from 'vitest'
import { updatedByField } from '@/src/collections/utils/updatedByField'
import { Beers } from '@/src/collections/Beers'
import { Menus } from '@/src/collections/Menus'

// Read access is covered with the other field-visibility rules in access-control.int.spec.ts.
const stamp = (user: { id: string } | null, value?: string) =>
  updatedByField.hooks.beforeChange[0]({ req: { user }, value } as never)

describe('updatedByField', () => {
  it('records the signed-in editor, ignoring the submitted value', () => {
    expect(stamp({ id: 'editor' }, 'someone-else')).toBe('editor')
  })

  it('keeps the previous editor on user-less system saves', () => {
    expect(stamp(null, 'editor')).toBe('editor')
  })

  it('is on Beers and Menus', () => {
    for (const collection of [Beers, Menus]) {
      expect(collection.fields).toContain(updatedByField)
    }
  })
})
