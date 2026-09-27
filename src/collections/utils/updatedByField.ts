/**
 * Shared `updatedBy` field for versioned collections (Beers, Menus).
 *
 * Payload versions record when a revision was saved but not who saved it.
 * A version is a snapshot of the document's fields, so stamping the editor
 * onto the document on every save makes each revision carry its author.
 * Revisions saved before this field existed have no author.
 */

import type { Field } from 'payload'
import { authenticatedFieldAccess } from '@/src/access/roles'

export const updatedByField: Field = {
  name: 'updatedBy',
  type: 'relationship',
  relationTo: 'users',
  // Published beers and menus are public; don't expose staff user IDs.
  access: { read: authenticatedFieldAccess },
  admin: {
    position: 'sidebar',
    readOnly: true,
    description: 'Who saved this revision',
  },
  hooks: {
    // User-less system saves (Untappd sync, scripts) keep the previous editor.
    beforeChange: [({ req, value }) => req.user?.id ?? value],
  },
}
