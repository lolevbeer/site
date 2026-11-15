/**
 * Rich text for short staff-written copy: FAQ answers, job descriptions (#375),
 * and the Site Content homepage introduction and About page sections.
 *
 * Each rich field sits beside the plain-text field it replaced. Staff edit the
 * rich field; `syncPlainCopy` keeps the plain field as a text copy. The copy is
 * what structured data and llms-full.txt read (FAQs, jobs), and what a build from before
 * this change (or a rollback) still renders, so the two can be deployed and
 * promoted in any order.
 */
import {
  BoldFeature,
  buildEditorState,
  FixedToolbarFeature,
  HeadingFeature,
  type HeadingFeatureProps,
  ItalicFeature,
  lexicalEditor,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import type { CollectionBeforeValidateHook, GlobalBeforeValidateHook, RichTextField } from 'payload'
import { richText as defaultRichTextValidate } from 'payload/shared'
import type { Faq, Job, SiteContent } from '@/src/payload-types'

/** Stored value of a `simpleEditor` field, whichever heading levels it allows. */
export type SimpleRichText =
  | NonNullable<Faq['answerRich']>
  | NonNullable<Job['descriptionRich']>
  | NonNullable<SiteContent['heroDescriptionRich']>

/** What `textToRichText` builds: paragraphs only, so it fits every `simpleEditor` field. */
type ParagraphsOnly = NonNullable<Faq['answerRich']> & NonNullable<Job['descriptionRich']>

/**
 * Editor for these fields: paragraphs, bold, italic, links to a URL, and lists.
 * No uploads, links to documents or font sizes, so every node has a plain-text
 * form and renders with the site's own styles.
 *
 * `headings` are the heading levels staff may add. Pass only the levels that
 * fit under the heading the page already renders above the field: a job
 * description sits under the page's h1, so it takes h2 and h3; a FAQ answer
 * sits under its question's h3, so it takes h4. Pair more than one level with
 * `validateHeadingOrder`.
 */
export function simpleEditor(headings: HeadingFeatureProps['enabledHeadingSizes'] = []) {
  return lexicalEditor({
    features: [
      ParagraphFeature(),
      ...(headings.length ? [HeadingFeature({ enabledHeadingSizes: headings })] : []),
      BoldFeature(),
      ItalicFeature(),
      LinkFeature({ enabledCollections: [] }),
      UnorderedListFeature(),
      OrderedListFeature(),
      FixedToolbarFeature(),
    ],
  })
}

/**
 * Field `validate` that keeps headings in outline order: the first heading is
 * `top` (the level just under the page's own heading), and no heading is more
 * than one level deeper than the one before it. Runs Payload's own rich text
 * validation (required, node checks) first.
 */
export function validateHeadingOrder(top: 2 | 3 | 4): NonNullable<RichTextField['validate']> {
  return async (value, options) => {
    const base = await defaultRichTextValidate(value, options)
    if (base !== true) return base

    let previous = top - 1
    for (const node of (value as SimpleRichText | null | undefined)?.root.children ?? []) {
      if (node.type !== 'heading') continue
      const level = Number(node.tag[1])
      if (level > previous + 1) {
        return previous < top
          ? `Start with a Heading ${top}; a Heading ${level} comes after it.`
          : `A Heading ${level} can't follow a Heading ${previous}. Use a Heading ${previous + 1} first.`
      }
      previous = level
    }
    return true
  }
}

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
export function textToRichText(text: string): ParagraphsOnly {
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

  return buildEditorState({ nodes: paragraphs }) as ParagraphsOnly
}

/** Editor state as plain text, paragraphs separated by a blank line. Empty for a missing value. */
export function richTextToPlain(state: SimpleRichText | null | undefined): string {
  return state ? convertLexicalToPlaintext({ data: state }).trim() : ''
}

/**
 * beforeValidate hook that keeps `plainField` and `richField` in step.
 *
 * Works on a collection or a global. A collection update passes the whole
 * merged document; a global update passes only what the caller sent. Either
 * way the change against the saved document decides:
 * - the rich field changed (the admin form) → rewrite the plain copy;
 * - only the plain field changed, or no rich value is sent or saved yet
 *   (scripts, seeds, older API callers) → rebuild the rich field from the
 *   plain text;
 * - neither changed → nothing.
 */
export function syncPlainCopy(
  richField: string,
  plainField: string,
): CollectionBeforeValidateHook & GlobalBeforeValidateHook {
  return ({ data, originalDoc }) => {
    if (!data) return data

    const rich = data[richField]
    const plain = data[plainField]
    const richChanged = Boolean(rich) && !sameJson(rich, originalDoc?.[richField])
    const plainChanged = typeof plain === 'string' && plain !== originalDoc?.[plainField]

    if (richChanged) {
      data[plainField] = richTextToPlain(rich)
    } else if (plainChanged || (!rich && !originalDoc?.[richField] && typeof plain === 'string')) {
      data[richField] = textToRichText(plain)
    }

    return data
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
