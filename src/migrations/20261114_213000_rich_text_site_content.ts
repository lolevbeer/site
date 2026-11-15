/**
 * Fill the Site Content rich-text fields from the existing plain text:
 * `heroDescriptionRich`, `aboutPhilosophyRich` and `aboutLocationsRich`. The
 * plain fields stay, so a build from before this change keeps working
 * whichever is promoted first. Safe to run twice: only missing rich fields are
 * written. A plain field that was never saved is skipped; pages then use the
 * field's default.
 */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'
import { textToRichText } from '../fields/rich-text'

const FIELDS = [
  { plain: 'heroDescription', rich: 'heroDescriptionRich' },
  { plain: 'aboutPhilosophy', rich: 'aboutPhilosophyRich' },
  { plain: 'aboutLocations', rich: 'aboutLocationsRich' },
] as const

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const globals = payload.db.globals.collection
  const doc = await globals.findOne({ globalType: 'site-content' })
  if (!doc) return

  const $set: Record<string, unknown> = {}
  for (const { plain, rich } of FIELDS) {
    if (doc[rich] === undefined && typeof doc[plain] === 'string') {
      $set[rich] = textToRichText(doc[plain])
    }
  }
  if (Object.keys($set).length) await globals.updateOne({ _id: doc._id }, { $set })
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Leave the rich fields; an older build ignores them and reads the plain text.
}
