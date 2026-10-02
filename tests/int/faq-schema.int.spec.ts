/**
 * resolveFAQs merges default and CMS FAQs into the one list that drives both
 * the visible FAQ answers and the FAQPage JSON-LD.
 */
import { describe, expect, it } from 'vitest'
import { generateFAQSchema, getBreweryFAQs, resolveFAQs } from '@/lib/utils/faq-schema'

const defaults = [
  { question: 'Do you have WiFi?', answer: 'Yes, free WiFi.' },
  { question: 'Are dogs allowed?', answer: 'Yes, leashed dogs.' },
]

describe('resolveFAQs', () => {
  it('keeps defaults in order and appends CMS-only questions in CMS order', () => {
    const resolved = resolveFAQs(defaults, [
      { question: 'Do you sell merch?', answer: 'Yes.' },
      { question: 'Is there a kids menu?', answer: 'Ask staff.' },
    ])
    expect(resolved.map((faq) => faq.question)).toEqual([
      'Do you have WiFi?',
      'Are dogs allowed?',
      'Do you sell merch?',
      'Is there a kids menu?',
    ])
  })

  it('lets a CMS answer replace the default in place, matching trimmed and case-normalized questions', () => {
    const resolved = resolveFAQs(defaults, [
      { question: '  ARE   DOGS allowed?  ', answer: 'Only on the patio.' },
    ])
    expect(resolved).toEqual([
      { question: 'Do you have WiFi?', answer: 'Yes, free WiFi.' },
      { question: 'Are dogs allowed?', answer: 'Only on the patio.' },
    ])
  })

  it('emits each normalized question once, first CMS duplicate winning', () => {
    const resolved = resolveFAQs(defaults, [
      { question: 'Do you sell merch?', answer: 'First.' },
      { question: ' do you sell merch? ', answer: 'Second.' },
    ])
    expect(resolved.filter((faq) => /merch/i.test(faq.question))).toEqual([
      { question: 'Do you sell merch?', answer: 'First.' },
    ])
    expect(resolved).toHaveLength(3)
  })

  it('does not fabricate answers from empty or missing CMS values', () => {
    const resolved = resolveFAQs(defaults, [
      { question: 'Are dogs allowed?', answer: '   ' },
      { question: 'No answer at all?', answer: null },
      { question: '', answer: 'Orphan answer.' },
      { question: null, answer: 'Another orphan.' },
      { answer: 'No question key.' },
    ])
    expect(resolved).toEqual(defaults)
  })

  it('drops empty default entries and tolerates no CMS entries', () => {
    expect(resolveFAQs([{ question: 'Q?', answer: '' }], [])).toEqual([])
    expect(resolveFAQs(defaults, [])).toEqual(defaults)
  })

  it('yields acceptedAnswer text identical to the resolved answers', () => {
    const resolved = resolveFAQs(getBreweryFAQs([]), [
      { question: 'do you have wifi?', answer: 'Custom wifi answer.' },
    ])
    const schema = generateFAQSchema(resolved)
    expect(schema.mainEntity.map((entity) => entity.acceptedAnswer.text)).toEqual(
      resolved.map((faq) => faq.answer),
    )
    expect(
      schema.mainEntity.find((entity) => entity.name === 'Do you have WiFi?')?.acceptedAnswer.text,
    ).toBe('Custom wifi answer.')
  })
})
