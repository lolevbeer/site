import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { beers } from '@/lib/data/beer-data';
import { BeerDetails } from '@/components/beer/beer-details';

interface BeerPageProps {
  params: {
    variant: string;
  };
}

export async function generateMetadata({ params }: BeerPageProps): Promise<Metadata> {
  const beer = beers.find(b => b.variant === params.variant);

  if (!beer) {
    return {
      title: 'Beer Not Found | Lolev Beer',
    };
  }

  return {
    title: `${beer.name} | Lolev Beer`,
    description: beer.description,
    openGraph: {
      title: `${beer.name} | Lolev Beer`,
      description: beer.description,
      type: 'website',
    },
  };
}

export async function generateStaticParams() {
  return beers.map((beer) => ({
    variant: beer.variant,
  }));
}

export default function BeerPage({ params }: BeerPageProps) {
  const beer = beers.find(b => b.variant === params.variant);

  if (!beer) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <BeerDetails beer={beer} />
    </div>
  );
}