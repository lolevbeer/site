/**
 * FAQ schema generation for frequently asked questions
 * Helps with FAQ rich results in search
 * @see https://schema.org/FAQPage
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */

import type { PayloadLocation } from '@/lib/types/location'
import {
  formatHoursFaqAnswer,
  formatLocationsFaqAnswer,
  joinLocationNames,
} from '@/lib/config/locations'

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
    answer:
      'Hours vary by taproom and holiday. See the footer of any page for this week.',
  },
  {
    question: 'Where are you located?',
    answer:
      'See our location pages or the footer for current taproom addresses.',
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
      'Yes! We offer private event space at both locations. For private event inquiries, please contact us at events@lolev.beer or call (412) 336-8965.',
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
      'Our beers are distributed throughout the Pittsburgh area and select locations in Pennsylvania, New York, and Ohio. Use our Beer Map to find the nearest retailer carrying Lolev Beer.',
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
  return breweryFAQs.map((faq) => {
    switch (faq.question) {
      case 'What are your hours of operation?':
        return locations.length > 0 ? { ...faq, answer: formatHoursFaqAnswer(locations) } : faq
      case 'Where are you located?':
        return locations.length > 0 ? { ...faq, answer: formatLocationsFaqAnswer(locations) } : faq
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
