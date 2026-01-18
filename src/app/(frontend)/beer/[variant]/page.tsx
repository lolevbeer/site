import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBeerBySlug, getAllBeersFromPayload } from '@/lib/utils/payload-api';
import { BeerDetails } from '@/components/beer/beer-details';
import { JsonLd } from '@/components/seo/json-ld';
import { generateProductSchema } from '@/lib/utils/product-schema';
import { generateBreadcrumbSchema } from '@/lib/utils/breadcrumb-schema';

interface BeerPageProps {
  params: Promise<{
    variant: string;
  }>;
}

export async function generateMetadata({ params }: BeerPageProps): Promise<Metadata> {
  const { variant } = await params;

  let beer;
  try {
    beer = await getBeerBySlug(variant);
  } catch {
    // Database error - return generic title
    return {
      title: 'Beer Not Found | Lolev Beer',
    };
  }

  if (!beer) {
    return {
      title: 'Beer Not Found | Lolev Beer',
    };
  }

  const styleName = typeof beer.style === 'string' ? beer.style : beer.style?.name || '';

  return {
    title: `${beer.name} | ${styleName}`,
    description: beer.description ?? undefined,
    openGraph: {
      title: `${beer.name} | ${styleName} | Lolev Beer`,
      description: beer.description ?? undefined,
      type: 'website',
    },
  };
}

// Limit static generation to popular beers only
// Others will be generated on-demand and cached
export async function generateStaticParams() {
  const beers = await getAllBeersFromPayload();

  // Only pre-render top 10 beers (adjust as needed)
  // Others will be generated on first request
  return beers
    .slice(0, 10)
    .map((beer) => ({
      variant: beer.slug,
    }));
}

// Enable ISR with 1 hour revalidation
export const revalidate = 3600;

export default async function BeerPage({ params }: BeerPageProps) {
  const { variant } = await params;

  let beer;
  try {
    beer = await getBeerBySlug(variant);
  } catch {
    // Database error - show not found page
    notFound();
  }

  if (!beer) {
    notFound();
  }

  // Generate Product schema for SEO
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productSchema = generateProductSchema(beer as any);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'Home', href: '/' },
    { label: 'Beer', href: '/beer' },
    { label: beer.name, href: `/beer/${beer.slug}` }
  ]);

  return (
    <>
      {/* Add Product JSON-LD for SEO */}
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <BeerDetails beer={beer as any} />
      </div>
    </>
  );
}