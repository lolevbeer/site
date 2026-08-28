/**
 * Shared definition of the "Mark Lines Cleaned" sidebar button.
 *
 * Both the Locations and Menus collections surface the same admin UI field
 * pointing at the same React component, and both gate it on the same roles;
 * only the extra visibility rule differs (Menus shows it on draft menus only).
 * Keeping one definition here stops the two copies from drifting — in
 * particular so the role gate can never be tightened in one place and left
 * open in the other.
 */

import type { UIField } from 'payload'
import { hasRole, LEAD_BARTENDER_ROLES } from '@/src/access/roles'

type MarkLinesCleanedFieldOptions = {
  /**
   * Extra condition on the document data, ANDed with the role check. Omit to
   * show the button to every permitted role regardless of the document.
   */
  showFor?: (data: Record<string, unknown> | undefined) => boolean
}

/**
 * Build the `markLinesCleanedButton` UI field. Visible only to the roles that
 * may record a line cleaning (admins and lead bartenders).
 */
export function markLinesCleanedField({ showFor }: MarkLinesCleanedFieldOptions = {}): UIField {
  return {
    name: 'markLinesCleanedButton',
    type: 'ui',
    admin: {
      position: 'sidebar',
      condition: (data, _siblingData, { user }) =>
        (showFor ? showFor(data) : true) && hasRole(user, LEAD_BARTENDER_ROLES),
      components: {
        Field: '@/src/components/admin/MarkLinesCleanedButton#MarkLinesCleanedButton',
      },
    },
  }
}
