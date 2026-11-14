/**
 * Fill the new rich-text fields from the existing plain text (#375):
 * `faqs.answerRich` from `faqs.answer`, `jobs.descriptionRich` from
 * `jobs.description`. The plain fields stay, so a build from before this
 * change keeps working whichever is promoted first. Safe to run twice: only
 * documents without the rich field are touched.
 */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'
import { textToRichText } from '../fields/rich-text'

const FIELDS = [
  { collection: 'faqs', plain: 'answer', rich: 'answerRich' },
  { collection: 'jobs', plain: 'description', rich: 'descriptionRich' },
] as const

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  for (const { collection, plain, rich } of FIELDS) {
    const { collection: raw } = payload.db.collections[collection]
    const docs = await raw.find({ [rich]: { $exists: false } }).toArray()

    for (const doc of docs) {
      if (typeof doc[plain] !== 'string') continue
      await raw.updateOne({ _id: doc._id }, { $set: { [rich]: textToRichText(doc[plain]) } })
    }
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Leave the rich fields; an older build ignores them and reads the plain text.
}
