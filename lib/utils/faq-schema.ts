/**
 * FAQ schema generation for frequently asked questions
 * Helps with FAQ rich results in search
 * @see https://schema.org/FAQPage
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */

export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Schema.org FAQPage type
 */
export interface FAQPageJsonLd {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: QuestionJsonLd[];
}

export interface QuestionJsonLd {
  '@type': 'Question';
  name: string;
  acceptedAnswer: AnswerJsonLd;
}

export interface AnswerJsonLd {
  '@type': 'Answer';
  text: string;
}

/**
 * Generate FAQ schema from array of questions and answers
 */
export function generateFAQSchema(faqs: FAQItem[]): FAQPageJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

/**
 * Brewery-specific FAQ data
 */
export const breweryFAQs: FAQItem[] = [
  {
    question: 'What are your hours of operation?',
    answer: 'Our Lawrenceville location is open Monday-Thursday 4pm-10pm, Friday-Saturday 12pm-12am, and Sunday 12pm-9pm. Our Zelienople location is open Monday-Thursday 5pm-10pm, Friday-Saturday 12pm-12am, and Sunday 12pm-9pm.'
  },
  {
    question: 'Where are you located?',
    answer: 'We have two locations: Our flagship brewery is at 5247 Butler Street in Pittsburgh\'s Lawrenceville neighborhood. Our second location is at 111 South Main Street in Zelienople, PA.'
  },
  {
    question: 'Do you serve food?',
    answer: 'We regularly partner with local food trucks that serve at both locations. Check our Food page for the current schedule of food vendors.'
  },
  {
    question: 'Are you family-friendly?',
    answer: 'Yes! Both of our locations welcome families. We have non-alcoholic beverages available. Children must be supervised by an adult at all times.'
  },
  {
    question: 'Are dogs allowed?',
    answer: 'Yes! Well-behaved, leashed dogs are welcome at both our Lawrenceville and Zelienople locations. We love our four-legged friends!'
  },
  {
    question: 'Can I book a private event?',
    answer: 'Yes! We offer private event space at both locations. For private event inquiries, please contact us at events@lolev.beer or call (412) 336-8965.'
  },
  {
    question: 'What types of beer do you brew?',
    answer: 'We focus on modern ales, expressive lagers, and oak-aged beers. Our lineup includes IPAs, stouts, sours, pilsners, saisons, and seasonal specialties. Check our Beer page for our current offerings.'
  },
  {
    question: 'Do you offer brewery tours?',
    answer: 'Yes! We offer brewery tours at our Lawrenceville production facility. Tours are typically available on weekends. Contact us for scheduling or check our Events page for upcoming tour dates.'
  },
  {
    question: 'Can I buy beer to take home?',
    answer: 'Yes! We sell cans and bottles of select beers to go. Check our Beer page to see which beers are currently available in cans at each location.'
  },
  {
    question: 'Where can I find your beer in stores?',
    answer: 'Our beers are distributed throughout the Pittsburgh area and select locations in Pennsylvania, New York, and Ohio. Use our Beer Map to find the nearest retailer carrying Lolev Beer.'
  },
  {
    question: 'Do you have gluten-free options?',
    answer: 'While we don\'t currently brew gluten-free beer, we do have non-alcoholic and cider options available. Our food truck partners often have gluten-free menu items.'
  },
  {
    question: 'Is there parking available?',
    answer: 'Street parking is available at our Lawrenceville location. Our Zelienople location has a free parking lot adjacent to the building with additional street parking on Main Street.'
  },
  {
    question: 'Do you have WiFi?',
    answer: 'Yes! Both locations offer free WiFi for customers.'
  },
  {
    question: 'Can I bring outside food?',
    answer: 'You are always welcome to bring outside food or order delivery.'
  },
  {
    question: 'Do you have outdoor seating?',
    answer: 'Yes! Both locations feature outdoor seating areas. Outdoor seating is available weather permitting.'
  },
  {
    question: 'How do I stay updated on new beer releases and events?',
    answer: 'Follow us on Instagram @lolevbeer, check our website regularly, or sign up for our newsletter. Our Events and Food pages are updated weekly with upcoming activities.'
  }
];
