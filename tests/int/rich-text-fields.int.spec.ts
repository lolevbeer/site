/**
 * Rich text for FAQ answers, job descriptions (#375) and the Site Content
 * homepage introduction and About page copy. The rich field is what
 * staff edit; the original text field stays as a plain copy kept in step by a
 * hook, so structured data, llms-full.txt, older builds and rollbacks keep
 * reading plain text.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import {
  richTextToPlain,
  syncPlainCopy,
  textToRichText,
  validateHeadingOrder,
} from '@/src/fields/rich-text'
import { FAQs } from '@/src/collections/FAQs'
import { Jobs } from '@/src/collections/Jobs'
import { up } from '@/src/migrations/20261114_170000_rich_text_faq_jobs'
import { SiteContent } from '@/src/globals/SiteContent'
import { up as upSiteContent } from '@/src/migrations/20261114_213000_rich_text_site_content'

type Hook = (args: {
  data?: Record<string, unknown>
  originalDoc?: Record<string, unknown>
}) => unknown

describe('textToRichText / richTextToPlain', () => {
  it('makes one paragraph per blank-line block and keeps single line breaks', () => {
    const state = textToRichText('First line\nsecond line\n\nNext paragraph')
    const paragraphs = state.root.children
    expect(paragraphs.map((p) => p.type)).toEqual(['paragraph', 'paragraph'])
    expect((paragraphs[0] as { children: { type: string }[] }).children.map((c) => c.type)).toEqual(
      ['text', 'linebreak', 'text'],
    )
  })

  it('round-trips plain text', () => {
    const text = 'First line\nsecond line\n\nNext paragraph'
    expect(richTextToPlain(textToRichText(text))).toBe(text)
  })

  // Job descriptions may carry h2/h3; the plain copy keeps the heading's text.
  it('keeps heading text in the plain copy', () => {
    const state = textToRichText('Body')
    state.root.children.unshift({
      ...state.root.children[0],
      type: 'heading',
      tag: 'h2',
      children: [{ type: 'text', text: 'What you will do', version: 1 }],
    } as never)
    expect(richTextToPlain(state)).toBe('What you will do\n\nBody')
  })

  it('treats empty input as empty', () => {
    expect(richTextToPlain(textToRichText(''))).toBe('')
    expect(richTextToPlain(null)).toBe('')
  })
})

/** A paragraph of body text with a heading of each given level before it. */
function withHeadings(...tags: string[]) {
  const state = textToRichText('Body')
  const headings = tags.map((tag) => ({
    ...state.root.children[0],
    type: 'heading',
    tag,
    children: [{ type: 'text', text: tag, version: 1 }],
  }))
  state.root.children.unshift(...(headings as never[]))
  return state
}

describe('validateHeadingOrder', () => {
  const validate = validateHeadingOrder(2) as unknown as (
    value: unknown,
    options: Record<string, unknown>,
  ) => Promise<string | true>
  // Payload's own rich text validation delegates to the field's editor.
  const editor = { validate: (value: unknown) => (value ? true : 'required') }
  const options = { required: true, editor }

  it.each([[[]], [['h2']], [['h2', 'h3', 'h3', 'h2']]])('accepts %j', async (tags) => {
    expect(await validate(withHeadings(...tags), options)).toBe(true)
  })

  it('refuses a description that opens with an h3', async () => {
    expect(await validate(withHeadings('h3'), options)).toMatch(/Start with a Heading 2/)
  })

  it('still requires a value', async () => {
    expect(await validate(null, options)).not.toBe(true)
  })
})

describe('syncPlainCopy', () => {
  const hook = syncPlainCopy('answerRich', 'answer') as unknown as Hook
  const saved = { answerRich: textToRichText('Saved answer'), answer: 'Saved answer' }

  it('derives the plain copy from the rich field on create', async () => {
    const data = { answerRich: textToRichText('New answer'), answer: 'ignored' }
    await hook({ data })
    expect(data.answer).toBe('New answer')
  })

  // Scripts, seeds and older API callers still send only the plain field.
  it('builds the rich field when a create sends only plain text', async () => {
    const data: Record<string, unknown> = { answer: 'Plain only' }
    await hook({ data })
    expect(richTextToPlain(data.answerRich as never)).toBe('Plain only')
  })

  // On update Payload passes the whole merged document, so both fields are
  // always present; what changed against the saved document decides.
  it('follows the rich field when staff edit it in the admin', async () => {
    const data = { answerRich: textToRichText('Edited answer'), answer: saved.answer }
    await hook({ data, originalDoc: saved })
    expect(data.answer).toBe('Edited answer')
  })

  it('follows the plain field when an update changes only that', async () => {
    const data: Record<string, unknown> = { answerRich: saved.answerRich, answer: 'Plain edit' }
    await hook({ data, originalDoc: saved })
    expect(richTextToPlain(data.answerRich as never)).toBe('Plain edit')
    expect(data.answer).toBe('Plain edit')
  })

  it('leaves a save that changes neither field alone', async () => {
    const data = { ...saved, active: false }
    await hook({ data, originalDoc: saved })
    expect(data).toEqual({ ...saved, active: false })
  })
})

describe('collections', () => {
  it.each([
    ['faqs', FAQs, 'answerRich', 'answer'],
    ['jobs', Jobs, 'descriptionRich', 'description'],
  ] as const)(
    '%s: staff edit %s, and %s is a hidden plain copy',
    (_slug, collection, rich, plain) => {
      const fields = collection.fields as {
        name?: string
        type: string
        admin?: { hidden?: boolean }
      }[]
      expect(fields.find((f) => f.name === rich)?.type).toBe('richText')
      const plainField = fields.find((f) => f.name === plain)
      expect(plainField?.type).toBe('textarea')
      expect(plainField?.admin?.hidden).toBe(true)
      expect(collection.hooks?.beforeValidate?.length).toBeGreaterThan(0)
    },
  )
})

describe('migration 20261114_170000_rich_text_faq_jobs', () => {
  function fakeCollection(docs: Record<string, unknown>[]) {
    return {
      docs,
      collection: {
        find: (filter: Record<string, unknown>) => ({
          toArray: async () => {
            const [richField] = Object.keys(filter)
            return docs.filter((d) => d[richField] === undefined)
          },
        }),
        updateOne: async (where: { _id: unknown }, update: { $set: Record<string, unknown> }) => {
          Object.assign(
            docs.find((d) => d._id === where._id)!,
            update.$set,
          )
        },
      },
    }
  }

  it('fills the rich field from the plain text, once, and skips documents already converted', async () => {
    const already = textToRichText('Already rich')
    const faqs = fakeCollection([
      { _id: 'f1', answer: 'Old answer\n\nSecond paragraph' },
      { _id: 'f2', answer: 'Plain copy', answerRich: already },
    ])
    const jobs = fakeCollection([{ _id: 'j1', description: 'Pour beer.' }])
    const payload = { db: { collections: { faqs, jobs } } }

    await up({ payload } as never)
    await up({ payload } as never)

    expect(richTextToPlain(faqs.docs[0].answerRich as never)).toBe('Old answer\n\nSecond paragraph')
    expect(faqs.docs[0].answer).toBe('Old answer\n\nSecond paragraph')
    expect(faqs.docs[1].answerRich).toBe(already)
    expect(richTextToPlain(jobs.docs[0].descriptionRich as never)).toBe('Pour beer.')
  })
})

// Site Content saves can carry part of the global (API callers), unlike the
// merged document a collection update gets.
describe('syncPlainCopy on a partial save', () => {
  const hook = syncPlainCopy('heroDescriptionRich', 'heroDescription') as unknown as Hook

  it('keeps saved formatting when only the unchanged plain copy is sent', async () => {
    const saved = { heroDescriptionRich: textToRichText('Saved'), heroDescription: 'Saved' }
    const data: Record<string, unknown> = { heroDescription: 'Saved' }
    await hook({ data, originalDoc: saved })
    expect(data).toEqual({ heroDescription: 'Saved' })
  })
})

describe('site content', () => {
  const tabs = SiteContent.fields[0] as { tabs: { fields: Record<string, unknown>[] }[] }
  const fields = tabs.tabs.flatMap((tab) => tab.fields) as {
    name?: string
    type: string
    defaultValue?: unknown
    admin?: { hidden?: boolean }
  }[]

  it.each([
    ['heroDescriptionRich', 'heroDescription'],
    ['aboutPhilosophyRich', 'aboutPhilosophy'],
    ['aboutLocationsRich', 'aboutLocations'],
  ] as const)(
    'staff edit %s, and %s is a hidden plain copy that keeps the default',
    (rich, plain) => {
      const richField = fields.find((f) => f.name === rich)
      const plainField = fields.find((f) => f.name === plain)
      expect(richField?.type).toBe('richText')
      expect(plainField?.type).toBe('textarea')
      expect(plainField?.admin?.hidden).toBe(true)
      // A default on the rich field would mask saved plain text before the migration runs.
      expect(richField?.defaultValue).toBeUndefined()
      expect(typeof plainField?.defaultValue).toBe('string')
      expect(SiteContent.hooks?.beforeValidate).toHaveLength(3)
    },
  )

  // The homepage introduction sits under the page's only h1, so its headings start at h2.
  it('keeps homepage introduction headings in outline order', async () => {
    const hero = fields.find((f) => f.name === 'heroDescriptionRich') as unknown as {
      validate: (value: unknown, options: unknown) => Promise<string | true>
    }
    // Payload's own rich text validation delegates to the field's editor.
    const options = { required: false, editor: { validate: () => true } }

    expect(await hero.validate(withHeadings('h2'), options)).toBe(true)
    expect(await hero.validate(withHeadings('h3'), options)).toMatch(/Start with a Heading 2/)
  })
})

describe('migration 20261114_213000_rich_text_site_content', () => {
  function fakeGlobals(doc: Record<string, unknown> | null) {
    return {
      collection: {
        findOne: async () => doc,
        updateOne: async (_where: unknown, update: { $set: Record<string, unknown> }) => {
          Object.assign(doc!, update.$set)
        },
      },
    }
  }

  it('fills each missing rich field from its plain text and leaves converted ones alone', async () => {
    const already = textToRichText('Already rich')
    const doc: Record<string, unknown> = {
      globalType: 'site-content',
      heroDescription: 'Hero\n\nSecond paragraph',
      aboutPhilosophy: 'Plain copy',
      aboutPhilosophyRich: already,
    }
    const payload = { db: { globals: fakeGlobals(doc) } }

    await upSiteContent({ payload } as never)
    await upSiteContent({ payload } as never)

    expect(richTextToPlain(doc.heroDescriptionRich as never)).toBe('Hero\n\nSecond paragraph')
    expect(doc.aboutPhilosophyRich).toBe(already)
    // Never saved in the CMS: nothing to convert, pages use the field default.
    expect(doc.aboutLocationsRich).toBeUndefined()
  })

  it('does nothing when Site Content has never been saved', async () => {
    await expect(
      upSiteContent({ payload: { db: { globals: fakeGlobals(null) } } } as never),
    ).resolves.toBeUndefined()
  })
})
