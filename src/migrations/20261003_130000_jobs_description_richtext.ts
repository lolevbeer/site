/**
 * Jobs `description` changed from a plain textarea to a Lexical rich-text field.
 *
 * Existing documents hold a string; the editor and renderers need Lexical JSON.
 * Each string becomes one paragraph per blank-line block (single newlines stay
 * as line breaks, matching the old `whitespace-pre-wrap` page). Documents that
 * are already objects are skipped, so a retry is harmless.
 */
import type { MigrateUpArgs } from '@payloadcms/db-mongodb'

const textNode = (text: string) => ({
  type: 'text',
  version: 1,
  text,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
})

const paragraph = (lines: string[]) => ({
  type: 'paragraph',
  version: 1,
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  children: lines.flatMap((line, i) =>
    i === 0 ? [textNode(line)] : [{ type: 'linebreak', version: 1 }, textNode(line)],
  ),
})

export function plainTextToLexical(text: string) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      // Lexical throws on a root with no children, so blank input becomes one empty paragraph.
      children: blocks.length
        ? blocks.map((block) => paragraph(block.split('\n').map((l) => l.trim())))
        : [paragraph([])],
    },
  }
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // Raw driver: payload.update would validate against the new richText shape and
  // fire revalidation hooks. No `session`; migrations run untransacted here.
  const collection = payload.db.collections['jobs'].collection
  const docs = await collection.find({ description: { $type: 'string' } }).toArray()
  for (const doc of docs) {
    await collection.updateOne(
      { _id: doc._id },
      { $set: { description: plainTextToLexical(doc.description as string) } },
    )
  }
}

export async function down(): Promise<void> {
  // No-op: rich text cannot be flattened back without losing formatting, and the
  // converted content stays readable if the field is ever reverted.
}
