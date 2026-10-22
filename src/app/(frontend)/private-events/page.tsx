/**
 * Private events landing page: the search target for "private event / party
 * venue" queries. The inquiry form is open on load, followed by each taproom's
 * address and a short FAQ that is also published as FAQPage JSON-LD.
 * Intro copy is editable in Site SEO ("Private events" → Intro text).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { Card, CardContent } from '@/components/ui/card'
import { HubIntro } from '@/components/ui/hub-intro'
import { JsonLd } from '@/components/seo/json-ld'
import { PageTransition } from '@/components/motion'
import { EventInquiryForm } from '@/components/events/event-inquiry-form'
import { joinLocationNames, taproomPhones } from '@/lib/config/locations'
import { buildPageMetadata } from '@/lib/seo/resolve-metadata'
import { generateFAQSchema, type FAQItem } from '@/lib/utils/faq-schema'
import { getAllLocations } from '@/lib/utils/payload-api'
import { getHubIntro } from '@/lib/utils/site-seo'
import { privateEventsDescription } from '@/lib/utils/seo'
import type { PayloadLocation } from '@/lib/types/location'

export const revalidate = 3600

const EVENTS_EMAIL = 'events@lolev.beer'

/** Taproom cities ("Pittsburgh and Zelienople"): what event seekers search, unlike the "Lolev …" names. */
function taproomCities(locations: PayloadLocation[]): string {
  const cities = [...new Set(locations.map((location) => location.address?.city).filter(Boolean))]
  return joinLocationNames(cities.map((name) => ({ name })))
}

export async function generateMetadata(): Promise<Metadata> {
  const locations = await getAllLocations()
  return buildPageMetadata({
    fallbackTitle: 'Private Events & Party Space',
    fallbackDescription: privateEventsDescription(
      taproomCities(locations.filter((location) => location.active !== false)),
    ),
    canonicalPath: '/private-events',
    fallbackKeywords: [
      'private event venue Pittsburgh',
      'brewery private party',
      'party venue Pittsburgh',
      'brewery event space',
      ...locations.map((location) => `private event space ${location.name}`),
    ],
    hubKey: 'privateEvents',
  })
}

/** Plain-text Q&As shared by the visible list and the FAQPage JSON-LD, so the two never drift. */
function privateEventFaqs(locations: PayloadLocation[]): FAQItem[] {
  const names = joinLocationNames(locations)
  const phones = taproomPhones(locations)
    .map(({ name, phone }) => `${name} at ${phone}`)
    .join(' or ')
  return [
    {
      question: 'Where can I host a private event at Lolev Beer?',
      answer: names
        ? `We have private event space at our ${names} taprooms.`
        : 'We have private event space at our taprooms.',
    },
    {
      question: 'How do I book a private event?',
      answer: `Send the form on this page with your preferred date, guest count, and taproom, and we will follow up about availability. You can also email ${EVENTS_EMAIL}${phones ? ` or call ${phones}` : ''}.`,
    },
    {
      question: 'Is my date booked once I send the form?',
      answer:
        'Not yet. The form is a request. Your event is booked once we confirm the details with you.',
    },
    {
      question: 'Can Lolev donate beer or host a fundraiser night?',
      answer:
        'Donation and fundraiser-night requests go through our donation request form, not the private event form.',
    },
  ]
}

export default async function PrivateEventsPage() {
  const [allLocations, intro] = await Promise.all([getAllLocations(), getHubIntro('privateEvents')])
  const taprooms = allLocations.filter((location) => location.active !== false)
  const faqs = privateEventFaqs(taprooms)
  const cities = taproomCities(taprooms)

  return (
    <>
      <JsonLd data={generateFAQSchema(faqs)} />
      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <PageBreadcrumbs className="mb-6" />
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold tracking-tight">Private events</h1>
            {intro ? (
              <HubIntro text={intro} />
            ) : (
              <p className="mt-3 text-muted-foreground text-balance">
                Host a birthday, team outing, or celebration at a Lolev Beer taproom
                {cities ? ` in ${cities}` : ''}. Tell us the date and headcount and we will get back
                to you about availability.
              </p>
            )}
          </div>

          <Card>
            <CardContent className="overflow-visible p-6">
              <EventInquiryForm taprooms={taprooms} />
            </CardContent>
          </Card>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Prefer email?{' '}
            <a href={`mailto:${EVENTS_EMAIL}`} className="underline hover:text-foreground">
              {EVENTS_EMAIL}
            </a>
          </p>

          {taprooms.length > 0 ? (
            <section className="mt-12">
              <h2 className="text-2xl font-semibold tracking-tight mb-4">Our taprooms</h2>
              <ul className="grid gap-4 sm:grid-cols-2 list-none p-0 m-0">
                {taprooms.map((location) => (
                  <li key={location.id}>
                    <Link
                      href={`/${location.slug}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {location.name}
                    </Link>
                    {location.address?.street ? (
                      <address className="not-italic text-sm text-muted-foreground">
                        {location.address.street}
                        <br />
                        {[location.address.city, location.address.state]
                          .filter(Boolean)
                          .join(', ')}{' '}
                        {location.address.zip}
                      </address>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight mb-4">Questions</h2>
            <dl className="space-y-6">
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="font-medium">{faq.question}</dt>
                  <dd className="mt-1 text-muted-foreground">{faq.answer}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm text-muted-foreground">
              Asking us to donate beer? Use the{' '}
              <Link href="/donate" className="underline hover:text-foreground">
                donation request form
              </Link>
              .
            </p>
          </section>
        </div>
      </PageTransition>
    </>
  )
}
