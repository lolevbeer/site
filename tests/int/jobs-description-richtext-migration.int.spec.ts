import { describe, expect, it, vi } from 'vitest'
import { plainTextToLexical, up } from '@/src/migrations/20261003_130000_jobs_description_richtext'

const paragraphs = (state: ReturnType<typeof plainTextToLexical>) =>
  state.root.children.map((p) =>
    (p as { children: { type: string; text?: string }[] }).children
      .map((c) => (c.type === 'linebreak' ? '\n' : c.text))
      .join(''),
  )

describe('plainTextToLexical', () => {
  it('makes one paragraph per blank-line-separated block', () => {
    expect(paragraphs(plainTextToLexical('Pour beer.\n\n  \nSmile.'))).toEqual([
      'Pour beer.',
      'Smile.',
    ])
  })

  it('keeps single newlines as line breaks, as the old pre-wrap page showed them', () => {
    expect(paragraphs(plainTextToLexical('Line one\nLine two'))).toEqual(['Line one\nLine two'])
  })

  it('yields one empty paragraph for blank text, since Lexical rejects a childless root', () => {
    expect(paragraphs(plainTextToLexical('  \n '))).toEqual([''])
  })
})

describe('jobs description migration', () => {
  const run = async (docs: { _id: string; description: string }[]) => {
    const updateOne = vi.fn()
    const find = vi.fn(() => ({ toArray: async () => docs }))
    await up({
      payload: { db: { collections: { jobs: { collection: { find, updateOne } } } } },
    } as never)
    return { find, updateOne }
  }

  it('converts only string descriptions, leaving rich-text ones alone', async () => {
    const { find, updateOne } = await run([{ _id: 'a', description: 'Pour beer.' }])
    expect(find).toHaveBeenCalledWith({ description: { $type: 'string' } })
    expect(updateOne).toHaveBeenCalledTimes(1)
    const [filter, update] = updateOne.mock.calls[0]
    expect(filter).toEqual({ _id: 'a' })
    expect(paragraphs(update.$set.description)).toEqual(['Pour beer.'])
  })
})
