/**
 * About Page
 * Company philosophy, locations, and background information
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { generateOrganizationSchema } from '@/lib/utils/local-business-schema';
import { generateBreadcrumbSchema } from '@/lib/utils/breadcrumb-schema';
import { generateAboutSpeakableSchema } from '@/lib/utils/speakable-schema';
import { PageTransition } from '@/components/motion';
import { getSiteContent } from '@/lib/utils/site-content';
import {
  DEFAULT_ABOUT_PHILOSOPHY,
  DEFAULT_ABOUT_LOCATIONS,
} from '@/lib/constants/site-content-defaults';

export const metadata: Metadata = {
  title: 'About | Lolev Beer',
  description: 'Learn about Lolev Beer, our brewing philosophy, and our locations in Lawrenceville and Zelienople.',
  keywords: ['about', 'brewery', 'philosophy', 'Lawrenceville', 'Zelienople', 'Pittsburgh brewery'],
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About | Lolev Beer',
    description: 'Learn about Lolev Beer, our brewing philosophy, and our locations in Lawrenceville and Zelienople.',
    type: 'website',
  },
};

/** Renders multi-paragraph text split by double newlines */
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((paragraph, i) => (
        <p key={i} className="mb-4">{paragraph}</p>
      ))}
    </>
  );
}

export default async function AboutPage() {
  const siteContent = await getSiteContent();
  const organizationSchema = generateOrganizationSchema();
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
  ]);
  const speakableSchema = generateAboutSpeakableSchema();

  const philosophy = siteContent.aboutPhilosophy ?? DEFAULT_ABOUT_PHILOSOPHY;
  const locations = siteContent.aboutLocations ?? DEFAULT_ABOUT_LOCATIONS;

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={speakableSchema} />
      <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <PageBreadcrumbs className="mb-6" />
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">About Lolev</h1>
        </div>

        <div className="prose prose-lg dark:prose-invert mx-auto">
          <section className="mb-12" data-speakable="philosophy">
            <h2 className="text-2xl font-semibold mb-4">Our Philosophy</h2>
            <Paragraphs text={philosophy} />
          </section>

          <section className="mb-12" data-speakable="locations">
            <h2 className="text-2xl font-semibold mb-4">Our Locations</h2>
            <Paragraphs text={locations} />
          </section>

          <div className="text-center mt-12 space-y-4">
            <div className="flex gap-4 justify-center flex-wrap">
              <Button asChild variant="default" size="lg">
                <Link href="/beer">Explore Our Beers</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/events">Upcoming Events</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
      </PageTransition>
    </>
  );
}
