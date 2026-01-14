/**
 * FAQ Page
 * Frequently asked questions about Lolev Beer
 */

import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { JsonLd } from '@/components/seo/json-ld';
import { breweryFAQs, generateFAQSchema, type FAQItem } from '@/lib/utils/faq-schema';
import { getActiveFAQs } from '@/lib/utils/payload-api';
import { Mail, Phone, MapPin } from 'lucide-react';

interface FAQAnswerProps {
  question: string;
  answer: string;
}

/**
 * Renders FAQ answer with special formatting for certain questions
 */
function FAQAnswer({ question, answer }: FAQAnswerProps): ReactNode {
  if (question === 'Where can I find your beer in stores?') {
    return (
      <div>
        Our beers are distributed throughout the Pittsburgh area and select locations in Pennsylvania, New York, and Ohio. Use our{' '}
        <Button asChild variant="default" size="sm" className="inline-flex">
          <Link href="/beer-map">Beer Map</Link>
        </Button>{' '}
        to find the nearest retailer carrying Lolev Beer.
      </div>
    );
  }

  if (question === 'How do I stay updated on new beer releases and events?') {
    return (
      <div>
        Follow us on social media (Instagram{' '}
        <a href="https://instagram.com/lolevbeer" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
          @lolevbeer
        </a>
        ), check our website regularly, or sign up for our newsletter. Our Events and Food pages are updated weekly with upcoming activities.
      </div>
    );
  }

  return answer;
}

export const metadata: Metadata = {
  title: 'FAQ | Frequently Asked Questions',
  description: 'Find answers to common questions about Lolev Beer including hours, locations, events, private bookings, beer styles, and more.',
  keywords: ['brewery faq', 'hours', 'location', 'private events', 'beer styles', 'Pittsburgh brewery'],
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: 'FAQ | Lolev Beer',
    description: 'Find answers to common questions about Lolev Beer including hours, locations, events, and more.',
    type: 'website',
  }
};

export default async function FAQPage() {
  // Fetch additional FAQs from CMS and combine with static FAQs
  const cmsFAQs = await getActiveFAQs();
  const dynamicFAQs: FAQItem[] = cmsFAQs.map(faq => ({
    question: faq.question,
    answer: faq.answer,
  }));

  // Combine static FAQs with CMS FAQs (CMS FAQs are appended)
  const allFAQs = [...breweryFAQs, ...dynamicFAQs];

  // Generate FAQ schema for SEO
  const faqSchema = generateFAQSchema(allFAQs);

  return (
    <>
      {/* Add FAQ JSON-LD for SEO */}
      <JsonLd data={faqSchema} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <PageBreadcrumbs className="mb-6" />

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Frequently Asked Questions
          </h1>
        </div>

        {/* FAQ Accordion */}
        <div className="mb-12">
          <Accordion type="single" collapsible className="w-full">
            {allFAQs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <FAQAnswer question={faq.question} answer={faq.answer} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Quick Links Section */}
        <div className="pt-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-4">Still have questions?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Contact Card */}
            <div className="rounded-lg p-6 space-y-4 text-center">
              <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
              <div className="space-y-3">
                <Button variant="ghost" size="sm" asChild className="w-full justify-center">
                  <a href="mailto:info@lolev.beer" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    info@lolev.beer
                  </a>
                </Button>
                <Button variant="ghost" size="sm" asChild className="w-full justify-center">
                  <a href="tel:4123368965" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    (412) 336-8965
                  </a>
                </Button>
              </div>
            </div>

            {/* Locations Card */}
            <div className="rounded-lg p-6 space-y-4 text-center">
              <h3 className="text-lg font-semibold mb-4">Our Locations</h3>
              <div className="space-y-3 text-sm">
                <div className="flex flex-col items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Lawrenceville</p>
                    <p className="text-muted-foreground">5247 Butler Street<br />Pittsburgh, PA 15201</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Zelienople</p>
                    <p className="text-muted-foreground">111 South Main Street<br />Zelienople, PA 16063</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild variant="default">
              <Link href="/about">About Us</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/beer">Our Beers</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/events">Upcoming Events</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/beer-map">Find Our Beer</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
