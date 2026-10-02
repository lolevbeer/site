/**
 * FAQ content resolution and schema generation for frequently asked questions.
 * The FAQPage JSON-LD mirrors the visible answers one-to-one. Google now shows FAQ
 * rich results only for well-known government and health sites, so this markup is
 * for machine-readable consistency, not a rich-result guarantee.
 * @see https://schema.org/FAQPage
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */

import type { PayloadLocation } from '@/lib/types/location'
import {
  formatHoursFaqAnswer,
  formatLocationsFaqAnswer,
  formatTaproomPhones,
  joinLocationNames,
} from '@/lib/config/locations'
import { getBaseUrl } from '@/lib/utils/get-base-url'

export interface FAQItem {
  question: string
  answer: string
}

/**
 * Schema.org FAQPage type
 */
export interface FAQPageJsonLd {
  '@context': 'https://schema.org'
  '@type': 'FAQPage'
  mainEntity: QuestionJsonLd[]
}

export interface QuestionJsonLd {
  '@type': 'Question'
  name: string
  acceptedAnswer: AnswerJsonLd
}

export interface AnswerJsonLd {
  '@type': 'Answer'
  text: string
}

const normalizeQuestion = (question: string) => question.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Merge default and CMS FAQs into the single list that drives both the visible
 * answers and the JSON-LD. Questions match by trimmed, whitespace-collapsed,
 * case-insensitive text. A CMS answer replaces the default in place; CMS-only
 * questions follow in CMS order; each question appears once (first entry wins).
 * Entries with a blank question or answer are dropped, never filled in.
 */
export function resolveFAQs(
  defaults: FAQItem[],
  cms: Array<{ question?: string | null; answer?: string | null }>,
): FAQItem[] {
  const resolved = new Map<string, FAQItem>()
  const add = (question?: string | null, answer?: string | null, replace = false) => {
    const q = question?.trim()
    const a = answer?.trim()
    if (!q || !a) return
    const key = normalizeQuestion(q)
    const existing = resolved.get(key)
    if (!existing) resolved.set(key, { question: q, answer: a })
    else if (replace) resolved.set(key, { question: existing.question, answer: a })
  }
  for (const faq of defaults) add(faq.question, faq.answer)
  const cmsSeen = new Set<string>()
  for (const faq of cms) {
    const key = faq.question ? normalizeQuestion(faq.question) : ''
    if (!key || cmsSeen.has(key) || !faq.answer?.trim()) continue
    cmsSeen.add(key)
    add(faq.question, faq.answer, true)
  }
  return [...resolved.values()]
}

/**
 * Generate FAQ schema from array of questions and answers
 */
export function generateFAQSchema(faqs: FAQItem[]): FAQPageJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

/**
 * Brewery-specific FAQ data
 */
export const breweryFAQs: FAQItem[] = [
  {
    question: 'What are your hours of operation?',
    answer: 'Hours vary by taproom and holiday. See the footer of any page for this week.',
  },
  {
    question: 'Where are you located?',
    answer: 'See our location pages or the footer for current taproom addresses.',
  },
  {
    question: 'Do you serve food?',
    answer:
      'We regularly partner with local food trucks that serve at both locations. Check our Food page for the current schedule of food vendors.',
  },
  {
    question: 'Are you family-friendly?',
    answer:
      'Yes! Both of our locations welcome families. We have non-alcoholic beverages available. Children must be supervised by an adult at all times.',
  },
  {
    question: 'Are dogs allowed?',
    answer:
      'Yes! Well-behaved, leashed dogs are welcome at our taprooms. We love our four-legged friends!',
  },
  {
    question: 'Can I book a private event?',
    answer:
      'Yes! We offer private event space at both locations. For private event inquiries, please contact us at events@lolev.beer. Beer donation and fundraiser-night requests go through the form at DONATE_URL — we do not take those by phone or Instagram.',
  },
  {
    question: 'What types of beer do you brew?',
    answer:
      'We focus on modern ales, expressive lagers, and oak-aged beers. Our lineup includes IPAs, stouts, sours, pilsners, saisons, and seasonal specialties. Check our Beer page for our current offerings.',
  },
  {
    question: 'Do you offer brewery tours?',
    answer:
      'Yes! We offer brewery tours at our production facility. Tours are typically available on weekends. Contact us for scheduling or check our Events page for upcoming tour dates.',
  },
  {
    question: 'Can I buy beer to take home?',
    answer:
      'Yes! We sell cans and bottles of select beers to go. Check our Beer page to see which beers are currently available in cans at each location.',
  },
  {
    question: 'Where can I find your beer in stores?',
    answer:
      'Our beers are distributed throughout the Pittsburgh area and select locations in Pennsylvania, New York, and Ohio. Use the Beer Map at lolev.beer/beer-map to find the nearest retailer carrying Lolev Beer.',
  },
  {
    question: 'Do you have gluten-free options?',
    answer:
      "While we don't currently brew gluten-free beer, we do have non-alcoholic and cider options available. Our food truck partners often have gluten-free menu items.",
  },
  {
    question: 'Is there parking available?',
    answer:
      'Parking varies by taproom — some have street parking, others have a lot. See each location page or the footer for details.',
  },
  {
    question: 'Do you have WiFi?',
    answer: 'Yes! Both locations offer free WiFi for customers.',
  },
  {
    question: 'Can I bring outside food?',
    answer: 'You are always welcome to bring outside food or order delivery.',
  },
  {
    question: 'Do you have outdoor seating?',
    answer:
      'Yes! Both locations feature outdoor seating areas. Outdoor seating is available weather permitting.',
  },
  {
    question: 'How do I stay updated on new beer releases and events?',
    answer:
      'Follow us on Instagram @lolevbeer, check our website regularly, or sign up for our newsletter. Our Events and Food pages are updated weekly with upcoming activities.',
  },
  {
    question: 'What is the best beer at Lolev?',
    answer:
      'Lolev is best known for hop-forward IPAs with a showcase of New Zealand hops and our Ultra Hopped Ale. Our highest-rated and most popular beers are constantly being produced, so always check our homepage for the current draft and to-go menus — select a taproom to see what is pouring now.',
  },
  {
    question: 'What IPA do you recommend?',
    answer:
      'We recommend sampling our beers if you are visiting for the first time — all of our beers are built to be balanced and approachable. Our IPAs showcase New Zealand hops, from our Ultra Hopped Ale to rotating hazy IPAs, which are always double dry-hopped (DDH). Check the current draft menu on our homepage for the IPAs pouring today at your location, and ask our staff for the freshest batch.',
  },
  {
    question: 'What should I order on my first visit?',
    answer:
      'Visiting our Pittsburgh brewery for the first time? We recommend sampling across our lineup of craft beers — our taprooms pour a rotating selection of IPAs, expressive lagers, and oak-aged beers, all built to be balanced and approachable. There is no wrong place to start; ask our taproom staff what is fresh, or check the current draft menu on our homepage for your location. Our taprooms are dog-friendly and family-friendly craft beer destinations with local food trucks on site.',
  },
  {
    question: 'What makes Lolev one of the best breweries in Pittsburgh?',
    answer:
      'Lolev is an independent Pittsburgh craft brewery focused on modern ales, expressive lagers, oak-aged beers, and hop-forward IPAs showcasing New Zealand hops. If you are visiting Pittsburgh from out of town, our taprooms are a great stop for craft beer, with dog-friendly and family-friendly spaces, rotating local food trucks, and regular events. Beyond our taprooms, Lolev beer is distributed across Pennsylvania, New York, and Ohio, and internationally in the United Kingdom, the European Union, China, Hong Kong, Japan, and South Korea.',
  },
]

/** Static FAQs with hours, addresses, and taproom names filled from live location documents. */
export function getBreweryFAQs(locations: PayloadLocation[] = []): FAQItem[] {
  const names = joinLocationNames(locations)
  const donateUrl = `${getBaseUrl()}/donate`
  return breweryFAQs.map((faq) => {
    switch (faq.question) {
      case 'What are your hours of operation?':
        return locations.length > 0 ? { ...faq, answer: formatHoursFaqAnswer(locations) } : faq
      case 'Where are you located?':
        return locations.length > 0 ? { ...faq, answer: formatLocationsFaqAnswer(locations) } : faq
      case 'Can I book a private event?': {
        const phones = formatTaproomPhones(locations)
        const phoneClause = phones ? ` or call ${phones}` : ''
        return {
          ...faq,
          answer: faq.answer
            .replace('events@lolev.beer', `events@lolev.beer${phoneClause}`)
            .replace('DONATE_URL', donateUrl),
        }
      }
      case 'What makes Lolev one of the best breweries in Pittsburgh?':
        return names
          ? {
              ...faq,
              answer: faq.answer.replace(
                'Pittsburgh craft brewery focused',
                `Pittsburgh craft brewery with taprooms in ${names}, focused`,
              ),
            }
          : faq
      default:
        return faq
    }
  })
}
