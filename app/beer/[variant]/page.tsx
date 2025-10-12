import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBeerByVariant, getAllBeersFromCSV } from '@/lib/utils/beer-csv';
import { BeerDetails } from '@/components/beer/beer-details';
import { mergeBeerDataWithCans } from '@/lib/utils/merge-beer-data';
import { JsonLd } from '@/components/seo/json-ld';
import { generateProductSchema } from '@/lib/utils/product-schema';

interface BeerPageProps {
  params: Promise<{
    variant: string;
  }>;
}

export async function generateMetadata({ params }: BeerPageProps): Promise<Metadata> {
  const { variant } = await params;
  const beer = await getBeerByVariant(variant);

  if (!beer) {
    return {
      title: 'Beer Not Found | Lolev Beer',
    };
  }

  return {
    title: `${beer.name} | ${beer.type}`,
    description: beer.description,
    openGraph: {
      title: `${beer.name} | ${beer.type} | Lolev Beer`,
      description: beer.description,
      type: 'website',
    },
  };
}

export async function generateStaticParams() {
  const beers = await getAllBeersFromCSV();
  return beers.map((beer) => ({
    variant: beer.variant,
  }));
}

export default async function BeerPage({ params }: BeerPageProps) {
  const { variant } = await params;
  const baseBeer = await getBeerByVariant(variant);

  if (!baseBeer) {
    notFound();
  }

  // Merge with latest can availability data
  const beer = await mergeBeerDataWithCans(baseBeer);

  // Generate Product schema for SEO
  const productSchema = generateProductSchema(beer);

  return (
    <>
      {/* Add Product JSON-LD for SEO */}
      <JsonLd data={productSchema} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <BeerDetails beer={beer} />
      </div>
    </>
  );
}