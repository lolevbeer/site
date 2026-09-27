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

export const updatedByField = {
  name: 'updatedBy',
  type: 'relationship',
  relationTo: 'users',
  // Reads return the user ID only; the admin sidebar and version compare view
  // look up the editor's email themselves (Users are readable by every
  // signed-in user for this), so populating it would be wasted work.
  maxDepth: 0,
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
} satisfies Field
