/**
 * FAQ Page
 * Frequently asked questions about Lolev Beer
 */

import { Metadata } from 'next';
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
import { breweryFAQs, generateFAQSchema } from '@/lib/utils/faq-schema';
import { Mail, Phone, MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'FAQ | Frequently Asked Questions',
  description: 'Find answers to common questions about Lolev Beer including hours, locations, events, private bookings, beer styles, and more.',
  keywords: ['brewery faq', 'hours', 'location', 'private events', 'beer styles', 'Pittsburgh brewery'],
  openGraph: {
    title: 'FAQ | Lolev Beer',
    description: 'Find answers to common questions about Lolev Beer including hours, locations, events, and more.',
    type: 'website',
  }
};

export default function FAQPage() {
  // Generate FAQ schema for SEO
  const faqSchema = generateFAQSchema(breweryFAQs);

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
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions about visiting Lolev Beer, our locations, events, and more.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="mb-12">
          <Accordion type="single" collapsible className="w-full">
            {breweryFAQs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Quick Links Section */}
        <div className="border-t pt-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-4">Still have questions?</h2>
            <p className="text-muted-foreground mb-6">
              We're here to help! Reach out to us or explore more about Lolev Beer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Contact Card */}
            <div className="border rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
              <div className="space-y-3">
                <Button variant="ghost" size="sm" asChild className="w-full justify-start">
                  <a href="mailto:info@lolev.beer" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    info@lolev.beer
                  </a>
                </Button>
                <Button variant="ghost" size="sm" asChild className="w-full justify-start">
                  <a href="tel:4123368965" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    (412) 336-8965
                  </a>
                </Button>
              </div>
            </div>

            {/* Locations Card */}
            <div className="border rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold mb-4">Our Locations</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Lawrenceville</p>
                    <p className="text-muted-foreground">5247 Butler Street<br />Pittsburgh, PA 15201</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
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
