import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { generateOrganizationSchema } from '@/lib/utils/local-business-schema';
import { generateBreadcrumbSchema } from '@/lib/utils/breadcrumb-schema';
import { generateAboutSpeakableSchema } from '@/lib/utils/speakable-schema';

export default function AboutPage() {
  const organizationSchema = generateOrganizationSchema();
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' }
  ]);
  const speakableSchema = generateAboutSpeakableSchema();

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={speakableSchema} />
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PageBreadcrumbs className="mb-6" />
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">About Lolev</h1>
      </div>

      <div className="prose prose-lg dark:prose-invert mx-auto">
        <section className="mb-12" data-speakable="philosophy">
          <h2 className="text-2xl font-semibold mb-4">Our Philosophy</h2>
          <p className="mb-4">
            We focus on creating beers that are purposeful and refined.
          </p>
          <p className="mb-4">
            Our approach combines traditional brewing techniques with modern innovation, always in service of flavor and quality. We source the finest ingredients, obsess over every detail of the brewing process, and refine our recipes.
          </p>
        </section>

        <section className="mb-12" data-speakable="locations">
          <h2 className="text-2xl font-semibold mb-4">Our Locations</h2>
          <p className="mb-4">
            Our flagship location in Lawrenceville is both our production brewery and taproom, where visitors can experience our beers in the space where they're created. We also have a taproom in Zelienople. A building which previously housed a Barq's bottling facility until the 1970s.
          </p>
          <p className="mb-4">
            Both locations offer a curated selection of our freshest draft beers and canned offerings. We regularly host food, live events, and community gatherings, creating spaces where people can connect over a good beer.
          </p>
        </section>

        <div className="text-center mt-12 space-y-4">
          <div className="flex gap-4 justify-center flex-wrap">
            <Button asChild variant="default" size="lg">
              <Link href="/beer">
                Explore Our Beers
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/events">
                Upcoming Events
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
