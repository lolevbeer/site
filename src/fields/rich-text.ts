/**
 * Rich text for short staff-written copy (FAQ answers, job descriptions; #375).
 *
 * Each rich field sits beside the plain-text field it replaced. Staff edit the
 * rich field; `syncPlainCopy` keeps the plain field as a text copy. The copy is
 * what structured data and llms-full.txt read, and what a build from before
 * this change (or a rollback) still renders, so the two can be deployed and
 * promoted in any order.
 */
import {
  BoldFeature,
  buildEditorState,
  FixedToolbarFeature,
  ItalicFeature,
  lexicalEditor,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import type { CollectionBeforeValidateHook } from 'payload'
import type { Faq } from '@/src/payload-types'

/** Stored value of a `simpleEditor` field (FAQ answers and job descriptions share it). */
export type SimpleRichText = NonNullable<Faq['answerRich']>

/**
 * Editor for these fields: paragraphs, bold, italic, links to a URL, and lists.
 * No headings, uploads or links to documents, so every node has a plain-text
 * form and renders with the site's own styles.
 */
export const simpleEditor = lexicalEditor({
  features: [
    ParagraphFeature(),
    BoldFeature(),
    ItalicFeature(),
    LinkFeature({ enabledCollections: [] }),
    UnorderedListFeature(),
    OrderedListFeature(),
    FixedToolbarFeature(),
  ],
})

const LINE_BREAK = { type: 'linebreak', version: 1 } as const

function textNode(text: string) {
  return {
    type: 'text',
    text,
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    version: 1,
  } as const
}

/** Plain text as editor state: one paragraph per blank-line block, single newlines as line breaks. */
export function textToRichText(text: string): SimpleRichText {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      type: 'paragraph' as const,
      children: block
        .split('\n')
        .flatMap((line, index) => (index === 0 ? [textNode(line)] : [LINE_BREAK, textNode(line)])),
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      textFormat: 0,
      textStyle: '',
      version: 1,
    }))

  return buildEditorState<SimpleRichText>({ nodes: paragraphs })
}

/** Editor state as plain text, paragraphs separated by a blank line. Empty for a missing value. */
export function richTextToPlain(state: SimpleRichText | null | undefined): string {
  return state ? convertLexicalToPlaintext({ data: state }).trim() : ''
}

/**
 * beforeValidate hook that keeps `plainField` and `richField` in step.
 *
 * On update Payload passes the whole merged document, so both fields are always
 * present and the change against the saved document decides:
 * - the rich field changed (the admin form) → rewrite the plain copy;
 * - only the plain field changed, or there is no rich value yet (scripts,
 *   seeds, older API callers) → rebuild the rich field from the plain text;
 * - neither changed → nothing.
 */
export function syncPlainCopy(richField: string, plainField: string): CollectionBeforeValidateHook {
  return ({ data, originalDoc }) => {
    if (!data) return data

    const rich = data[richField]
    const plain = data[plainField]
    const richChanged = Boolean(rich) && !sameJson(rich, originalDoc?.[richField])
    const plainChanged = typeof plain === 'string' && plain !== originalDoc?.[plainField]

    if (richChanged) {
      data[plainField] = richTextToPlain(rich)
    } else if (plainChanged || (!rich && typeof plain === 'string')) {
      data[richField] = textToRichText(plain)
    }

    return data
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
