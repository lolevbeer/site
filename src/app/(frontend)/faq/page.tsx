/**
 * FAQ Page
 * Frequently asked questions about Lolev Beer
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { JsonLd } from '@/components/seo/json-ld'
import { getBreweryFAQs, generateFAQSchema, resolveFAQs } from '@/lib/utils/faq-schema'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { generateFAQSpeakableSchema } from '@/lib/utils/speakable-schema'
import { getActiveFAQs, getAllLocations } from '@/lib/utils/payload-api'
import { PageTransition } from '@/components/motion'
import { FaqContactSection } from '@/components/faq/faq-contact'
import { taproomPhones } from '@/lib/config/locations'
import type { PayloadLocation } from '@/lib/types/location'
import { buildPageMetadata } from '@/lib/seo/resolve-metadata'

interface LinkTarget {
  text: string
  href: string
  external?: boolean
}

const LINK_CLASS = 'text-primary hover:underline font-medium'

// A phrase is linked only as a whole token: not glued to a preceding word, "@", ".", "-"
// (info@lolevbeer.com), nor followed by more word/path/domain text (events@lolev.beer.au,
// lolev.beer/beer-map-foo). A trailing sentence period is still a boundary.
const BEFORE = String.raw`(?<![\w@.\-/])`
const AFTER = String.raw`(?![\w@\-/]|\.\w)`

/**
 * Renders the resolved answer text verbatim as plain (escaped) text, linking only
 * phrases that already appear in it. No wording is added or replaced here.
 */
function FAQAnswer({ answer, locations }: { answer: string; locations: PayloadLocation[] }) {
  const baseUrl = getBaseUrl()
  const targets: LinkTarget[] = [
    { text: 'events@lolev.beer', href: 'mailto:events@lolev.beer' },
    { text: `${baseUrl}/donate`, href: '/donate' },
    { text: `${baseUrl}/beer-map`, href: '/beer-map' },
    { text: 'lolev.beer/beer-map', href: '/beer-map' },
    { text: '@lolevbeer', href: 'https://instagram.com/lolevbeer', external: true },
    ...taproomPhones(locations).map(({ phone }) => ({
      text: phone,
      href: `tel:${phone.replace(/[^\d+]/g, '')}`,
    })),
  ].sort((a, b) => b.text.length - a.text.length)

  const escaped = targets.map((target) => target.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`${BEFORE}(${escaped.join('|')})${AFTER}`)
  // split() with one capture group puts every matched phrase at an odd index
  return answer.split(pattern).map((part, index) => {
    const target =
      index % 2 === 1 ? targets.find((candidate) => candidate.text === part) : undefined
    if (!target) return part
    if (target.href.startsWith('/')) {
      return (
        <Link key={index} href={target.href} className={LINK_CLASS}>
          {part}
        </Link>
      )
    }
    return (
      <a
        key={index}
        href={target.href}
        className={LINK_CLASS}
        {...(target.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {part}
      </a>
    )
  })
}

// ISR: revalidate every hour (FAQ content changes infrequently)
export const revalidate = 3600

const FAQ_DESCRIPTION =
  'Hours, taproom locations, food, dogs, private events, and beer styles at Lolev Beer.'

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    fallbackTitle: 'FAQ',
    fallbackDescription: FAQ_DESCRIPTION,
    canonicalPath: '/faq',
    fallbackKeywords: [
      'brewery faq',
      'hours',
      'location',
      'private events',
      'beer styles',
      'Pittsburgh brewery',
    ],
    hubKey: 'faq',
  })
}

export default async function FAQPage() {
  const [cmsFAQs, locations] = await Promise.all([getActiveFAQs(), getAllLocations()])
  // One resolved list drives both the visible answers and the JSON-LD
  const allFAQs = resolveFAQs(getBreweryFAQs(locations), cmsFAQs)

  const faqSchema = generateFAQSchema(allFAQs)
  const speakableSchema = generateFAQSpeakableSchema()

  return (
    <>
      {/* Add FAQ JSON-LD for SEO */}
      <JsonLd data={faqSchema} />
      <JsonLd data={speakableSchema} />

      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <PageBreadcrumbs className="mb-6" />

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Frequently Asked Questions</h1>
          </div>

          {/* FAQ Accordion */}
          <div className="mb-12">
            <Accordion type="single" collapsible className="w-full">
              {allFAQs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  {/* forceMount keeps closed answers in the server HTML so crawlers
                    and AI fetchers see the full Q&A; the closed state is hidden
                    with CSS instead of being unmounted. */}
                  <AccordionContent
                    forceMount
                    className="text-muted-foreground data-[state=closed]:hidden"
                    data-speakable="faq-answer"
                  >
                    <FAQAnswer answer={faq.answer} locations={locations} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <FaqContactSection />
        </div>
      </PageTransition>
    </>
  )
}
