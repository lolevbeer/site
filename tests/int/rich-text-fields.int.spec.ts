/**
 * Rich text for FAQ answers and job descriptions (#375). The rich field is what
 * staff edit; the original text field stays as a plain copy kept in step by a
 * hook, so structured data, llms-full.txt, older builds and rollbacks keep
 * reading plain text.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { richTextToPlain, syncPlainCopy, textToRichText } from '@/src/fields/rich-text'
import { FAQs } from '@/src/collections/FAQs'
import { Jobs } from '@/src/collections/Jobs'
import { up } from '@/src/migrations/20261114_170000_rich_text_faq_jobs'

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

  it('treats empty input as empty', () => {
    expect(richTextToPlain(textToRichText(''))).toBe('')
    expect(richTextToPlain(null)).toBe('')
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
