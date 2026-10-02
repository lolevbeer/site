/**
 * /faq renders one resolved answer list as both visible text and FAQPage JSON-LD.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

vi.mock('@/lib/utils/payload-api', () => ({
  getActiveFAQs: vi.fn(),
  getAllLocations: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    createElement('a', { href, 'data-next-link': 'true', ...rest }, children as never),
}))
vi.mock('@/lib/seo/resolve-metadata', () => ({ buildPageMetadata: vi.fn() }))
vi.mock('@/components/ui/page-breadcrumbs', () => ({ PageBreadcrumbs: () => null }))
vi.mock('@/components/faq/faq-contact', () => ({ FaqContactSection: () => null }))
vi.mock('@/components/motion', () => ({
  PageTransition: ({ children }: { children: unknown }) => children,
}))

import FAQPage from '@/src/app/(frontend)/faq/page'
import { getActiveFAQs, getAllLocations } from '@/lib/utils/payload-api'

const cms = getActiveFAQs as ReturnType<typeof vi.fn>
const locations = getAllLocations as ReturnType<typeof vi.fn>

const LOCATIONS = [
  { name: 'Lawrenceville', basicInfo: { phone: '(412) 336-8965' } },
  { name: 'Zelienople', basicInfo: { phone: '(724) 609-5100' } },
]

async function renderPage() {
  const html = renderToString(await FAQPage())
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const schemas = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map(
    (node) => JSON.parse(node.textContent ?? ''),
  )
  const faqSchema = schemas.find((schema) => schema['@type'] === 'FAQPage')
  const answers = Array.from(doc.querySelectorAll('[data-speakable="faq-answer"]'))
  return { html, doc, faqSchema, answers }
}

beforeEach(() => {
  cms.mockReset()
  locations.mockReset()
  locations.mockResolvedValue(LOCATIONS)
  cms.mockResolvedValue([])
})

describe('FAQPage', () => {
  it('renders every JSON-LD acceptedAnswer as the same static answer text, closed, in initial HTML', async () => {
    cms.mockResolvedValue([{ question: ' do you have wifi? ', answer: 'Patio WiFi only.' }])
    const { faqSchema, answers } = await renderPage()

    expect(faqSchema.mainEntity.length).toBe(answers.length)
    faqSchema.mainEntity.forEach((entity: { acceptedAnswer: { text: string } }, index: number) => {
      expect(answers[index].textContent).toBe(entity.acceptedAnswer.text)
      expect(answers[index].getAttribute('data-state')).toBe('closed')
    })
    expect(
      faqSchema.mainEntity.filter((entity: { name: string }) => /wifi/i.test(entity.name)),
    ).toHaveLength(1)
    expect(answers.some((el) => el.textContent === 'Patio WiFi only.')).toBe(true)
  })

  it('does not replace answers by question text', async () => {
    cms.mockResolvedValue([
      { question: 'Where can I find your beer in stores?', answer: 'Ask your local bottle shop.' },
      { question: 'Can I book a private event?', answer: 'Email us.' },
      {
        question: 'How do I stay updated on new beer releases and events?',
        answer: 'Carrier pigeon.',
      },
    ])
    const { answers, html } = await renderPage()
    const texts = answers.map((el) => el.textContent)
    expect(texts).toContain('Ask your local bottle shop.')
    expect(texts).toContain('Email us.')
    expect(texts).toContain('Carrier pigeon.')
    expect(html).not.toContain('donation request form')
  })

  it('links only text that is present in the answer, with safe hrefs', async () => {
    const { doc, answers } = await renderPage()
    const privateEvent = answers.find((el) => el.textContent?.includes('events@lolev.beer'))!
    const hrefs = Array.from(privateEvent.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('mailto:events@lolev.beer')
    expect(hrefs).toContain('tel:4123368965')
    expect(hrefs).toContain('tel:7246095100')
    expect(hrefs).toContain('/donate')
    const stores = answers.find((el) => el.textContent?.includes('lolev.beer/beer-map'))!
    expect(stores.querySelector('a')?.getAttribute('href')).toBe('/beer-map')
    expect(doc.querySelectorAll('a[href^="javascript:"]').length).toBe(0)
  })

  it('does not add links when a CMS override omits the linkable text', async () => {
    cms.mockResolvedValue([{ question: 'Can I book a private event?', answer: 'Email us.' }])
    const { answers } = await renderPage()
    const override = answers.find((el) => el.textContent === 'Email us.')!
    expect(override.querySelector('a')).toBeNull()
  })

  it('renders CMS text as escaped plain text, never HTML', async () => {
    const payload = '<img src=x onerror=alert(1)> <script>alert(2)</script> <b>bold</b>'
    cms.mockResolvedValue([{ question: 'Is this safe?', answer: payload }])
    const { html, doc, faqSchema, answers } = await renderPage()

    const answer = answers.find((el) => el.textContent === payload)!
    expect(answer.querySelector('img, b, script')).toBeNull()
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>alert(2)')
    expect(
      faqSchema.mainEntity.find((entity: { name: string }) => entity.name === 'Is this safe?')
        .acceptedAnswer.text,
    ).toBe(payload)
    expect(doc.querySelectorAll('script:not([type="application/ld+json"])').length).toBe(0)
  })

  it('renders no fabricated answer for empty CMS rows', async () => {
    cms.mockResolvedValue([
      { question: 'Blank answer?', answer: '  ' },
      { question: '', answer: 'Blank question.' },
    ])
    const { faqSchema, answers, html } = await renderPage()
    expect(html).not.toContain('Blank answer?')
    expect(html).not.toContain('Blank question.')
    expect(answers.length).toBe(faqSchema.mainEntity.length)
  })

  it('links only whole-token matches in CMS-authored text, preserving the exact text', async () => {
    const answer =
      'Write info@lolevbeer.com or events@lolev.beer.au, not events@lolev.beer. ' +
      'See lolev.beer/beer-map-foo or lolev.beer/beer-map/x, then lolev.beer/beer-map. ' +
      'Donate at https://lolev.beer/donate-now or https://lolev.beer/donate. ' +
      'Call (412) 336-8965-1 or (724) 609-5100. Follow @lolevbeer.'
    cms.mockResolvedValue([{ question: 'Where to look?', answer }])
    const { answers } = await renderPage()
    const el = answers.find((node) => node.textContent === answer)!
    expect(el).toBeTruthy()

    const links = Array.from(el.querySelectorAll('a')).map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ])
    expect(links).toEqual([
      ['events@lolev.beer', 'mailto:events@lolev.beer'],
      ['lolev.beer/beer-map', '/beer-map'],
      ['https://lolev.beer/donate', '/donate'],
      ['(724) 609-5100', 'tel:7246095100'],
      ['@lolevbeer', 'https://instagram.com/lolevbeer'],
    ])
  })

  it('uses next/link for internal hrefs and a new-tab noopener link only for Instagram', async () => {
    const { answers } = await renderPage()
    const anchors = answers.flatMap((el) => Array.from(el.querySelectorAll('a')))
    const byHref = (href: string) => anchors.filter((a) => a.getAttribute('href') === href)

    for (const href of ['/donate', '/beer-map']) {
      const matches = byHref(href)
      expect(matches.length).toBeGreaterThan(0)
      matches.forEach((a) => {
        expect(a.getAttribute('data-next-link')).toBe('true')
        expect(a.getAttribute('target')).toBeNull()
      })
    }
    const instagram = byHref('https://instagram.com/lolevbeer')
    expect(instagram.length).toBeGreaterThan(0)
    instagram.forEach((a) => {
      expect(a.textContent).toBe('@lolevbeer')
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
      expect(a.getAttribute('data-next-link')).toBeNull()
    })
    expect(byHref('mailto:events@lolev.beer')[0].getAttribute('data-next-link')).toBeNull()
  })
})
