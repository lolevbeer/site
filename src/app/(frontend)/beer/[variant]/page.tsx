import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBeerBySlug, getAllBeersFromPayload } from '@/lib/utils/payload-api';
import { BeerDetails } from '@/components/beer/beer-details';
import { JsonLd } from '@/components/seo/json-ld';
import { generateProductSchema } from '@/lib/utils/product-schema';
import { isAuthenticated } from '@/lib/utils/auth';

interface BeerPageProps {
  params: Promise<{
    variant: string;
  }>;
}

export async function generateMetadata({ params }: BeerPageProps): Promise<Metadata> {
  const { variant } = await params;
  const beer = await getBeerBySlug(variant);

  if (!beer) {
    return {
      title: 'Beer Not Found | Lolev Beer',
    };
  }

  const styleName = typeof beer.style === 'string' ? beer.style : beer.style?.name || '';

  return {
    title: `${beer.name} | ${styleName}`,
    description: beer.description,
    openGraph: {
      title: `${beer.name} | ${styleName} | Lolev Beer`,
      description: beer.description,
      type: 'website',
    },
  };
}

export async function generateStaticParams() {
  const beers = await getAllBeersFromPayload();
  return beers.map((beer) => ({
    variant: beer.slug,
  }));
}

export default async function BeerPage({ params }: BeerPageProps) {
  const { variant } = await params;
  const beer = await getBeerBySlug(variant);

  if (!beer) {
    notFound();
  }

  // Check if user is authenticated
  const authenticated = await isAuthenticated();

  // Generate Product schema for SEO
  const productSchema = generateProductSchema(beer);

  return (
    <>
      {/* Add Product JSON-LD for SEO */}
      <JsonLd data={productSchema} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <BeerDetails beer={beer} isAuthenticated={authenticated} />
      </div>
    </>
  );
}