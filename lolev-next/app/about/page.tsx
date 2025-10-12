import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PageBreadcrumbs className="mb-6" />
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">About Lolev</h1>
      </div>

      <div className="prose prose-lg dark:prose-invert mx-auto">
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Our Philosophy</h2>
          <p className="mb-4">
            We focus on creating beers that are purposeful, refined, and worth savoring.
          </p>
          <p className="mb-4">
            Our approach combines traditional brewing techniques with modern innovation, always in service of flavor and quality. We source the finest ingredients, obsess over every detail of the brewing process, and constantly refine our recipes to achieve the perfect balance in every glass.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Our Locations</h2>
          <p className="mb-4">
            Our flagship location in Lawrenceville serves as both our production brewery and taproom, where visitors can experience our beers in the very space where they're created. We've also expanded to Zelienople, bringing our carefully crafted beers to another Pennsylvania community.
          </p>
          <p className="mb-4">
            Both locations offer a curated selection of our draft beers and canned offerings, along with rotating seasonal releases and limited editions. We regularly host food trucks, live events, and community gatherings, creating spaces where people can connect over exceptional beer.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Community & Events</h2>
          <p className="mb-4">
            We're a gathering place for our community. From weekly food truck partnerships to special events and seasonal celebrations, we're committed to creating memorable experiences that bring people together. Our taprooms serve as hubs for conversation, creativity, and connection.
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
  );
}
