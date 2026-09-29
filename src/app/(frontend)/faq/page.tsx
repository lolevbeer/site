/**
 * FAQ Page
 * Frequently asked questions about Lolev Beer
 */

import type { ReactNode } from 'react'
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
import { getBreweryFAQs, generateFAQSchema, type FAQItem } from '@/lib/utils/faq-schema'
import { generateFAQSpeakableSchema } from '@/lib/utils/speakable-schema'
import { getActiveFAQs, getAllLocations } from '@/lib/utils/payload-api'
import { PageTransition } from '@/components/motion'
import { FaqContactSection } from '@/components/faq/faq-contact'
import { taproomPhones } from '@/lib/config/locations'
import type { PayloadLocation } from '@/lib/types/location'
import { buildPageMetadata } from '@/lib/seo/resolve-metadata'

interface FAQAnswerProps {
  question: string
  answer: string
  locations: PayloadLocation[]
}

/**
 * Renders FAQ answer with special formatting for certain questions
 */
function FAQAnswer({ question, answer, locations }: FAQAnswerProps): ReactNode {
  if (question === 'Where can I find your beer in stores?') {
    return (
      <div>
        Our beers are distributed throughout the Pittsburgh area and select locations in
        Pennsylvania, New York, and Ohio. Use our{' '}
        <Link href="/beer-map" className="text-primary hover:underline font-medium">
          Beer Map
        </Link>{' '}
        to find the nearest retailer carrying Lolev Beer.
      </div>
    )
  }

  if (question === 'Can I book a private event?') {
    const phones = taproomPhones(locations)
    return (
      <div>
        Yes! We offer private event space at both locations. For private event inquiries, please
        contact us at{' '}
        <a href="mailto:events@lolev.beer" className="text-primary hover:underline font-medium">
          events@lolev.beer
        </a>
        {phones.length > 0 ? (
          <>
            {' '}
            or call{' '}
            {phones.map((entry, index) => {
              let separator = ''
              if (index > 0) separator = index === phones.length - 1 ? ' or ' : ', '
              return (
                <span key={entry.phone}>
                  {separator}
                  {entry.name} at{' '}
                  <a
                    href={`tel:${entry.phone}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {entry.phone}
                  </a>
                </span>
              )
            })}
          </>
        ) : null}
        . Beer donation and fundraiser-night requests go through the{' '}
        <Link href="/donate" className="text-primary hover:underline font-medium">
          donation request form
        </Link>{' '}
        — we do not take those by phone or Instagram.
      </div>
    )
  }

  if (question === 'How do I stay updated on new beer releases and events?') {
    return (
      <div>
        Follow us on social media (Instagram{' '}
        <a
          href="https://instagram.com/lolevbeer"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium"
        >
          @lolevbeer
        </a>
        ), check our website regularly, or sign up for our newsletter. Our Events and Food pages are
        updated weekly with upcoming activities.
      </div>
    )
  }

  return answer
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
  const dynamicFAQs: FAQItem[] = cmsFAQs.map((faq) => ({
    question: faq.question,
    answer: faq.answer,
  }))

  const allFAQs = [...getBreweryFAQs(locations), ...dynamicFAQs]

  // Generate FAQ schema for SEO
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
                    <FAQAnswer question={faq.question} answer={faq.answer} locations={locations} />
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
