/**
 * Product schema generation for beer products
 * Helps with product discovery and rich snippets
 * @see https://schema.org/Product
 * @see https://developers.google.com/search/docs/appearance/structured-data/product
 */

import { Beer, UntappdReview } from '@/lib/types/beer';

/**
 * Schema.org Product type
 */
export interface ReviewJsonLd {
  '@type': 'Review';
  author: {
    '@type': 'Person';
    name: string;
  };
  reviewRating: {
    '@type': 'Rating';
    ratingValue: string;
    bestRating: string;
    worstRating: string;
  };
  reviewBody: string;
  datePublished?: string;
  url?: string;
}

export interface ProductJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  description?: string;
  image?: string | string[];
  brand: BrandJsonLd;
  category?: string;
  offers?: OfferJsonLd | OfferJsonLd[];
  aggregateRating?: AggregateRatingJsonLd;
  review?: ReviewJsonLd[];
  additionalProperty?: PropertyValueJsonLd[];
  sku?: string;
  gtin?: string;
}

export interface BrandJsonLd {
  '@type': 'Brand';
  name: string;
  logo?: string;
  url?: string;
}

export interface OfferJsonLd {
  '@type': 'Offer';
  price?: string;
  priceCurrency?: string;
  availability: string;
  url?: string;
  seller?: OrganizationJsonLd;
  priceValidUntil?: string;
  itemCondition?: string;
}

export interface OrganizationJsonLd {
  '@type': 'Organization';
  name: string;
  url?: string;
}

export interface AggregateRatingJsonLd {
  '@type': 'AggregateRating';
  ratingValue: string;
  reviewCount: string;
  bestRating?: string;
  worstRating?: string;
}

export interface PropertyValueJsonLd {
  '@type': 'PropertyValue';
  name: string;
  value: string | number;
}

/**
 * Get beer style name from either type field or style relationship
 */
function getBeerStyleName(beer: Beer & { style?: unknown }): string {
  // Check for type field (legacy Beer interface)
  if (beer.type && typeof beer.type === 'string') {
    return beer.type;
  }
  // Check for style relationship (Payload beer)
  if (beer.style) {
    if (typeof beer.style === 'string') {
      return beer.style;
    }
    if (typeof beer.style === 'object' && beer.style !== null && 'name' in beer.style) {
      return (beer.style as { name: string }).name;
    }
  }
  return 'Beer';
}

/**
 * Get beer category/style
 */
function getBeerCategory(beer: Beer & { style?: unknown }): string {
  const styleName = getBeerStyleName(beer);
  return `Craft Beer > ${styleName}`;
}

/**
 * Generate offers array for a beer
 */
function generateOffers(beer: Beer & { slug?: string; draftPrice?: number; fourPack?: number }): OfferJsonLd[] {
  const offers: OfferJsonLd[] = [];
  const baseUrl = 'https://lolev.beer';
  const beerSlug = beer.slug || beer.variant || beer.id;

  // Get draft price from either direct field (Payload) or pricing object (legacy)
  const draftPrice = beer.draftPrice || beer.pricing?.draftPrice;
  // Get four pack price from either direct field (Payload) or pricing object (legacy)
  const fourPackPrice = beer.fourPack || beer.pricing?.fourPack;

  // Draft offer with price
  if (draftPrice) {
    offers.push({
      '@type': 'Offer',
      price: draftPrice.toString(),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: `${baseUrl}/beer/${beerSlug}`,
      seller: {
        '@type': 'Organization',
        name: 'Lolev Beer',
        url: baseUrl
      }
    });
  }

  // Four pack offer with price
  if (fourPackPrice) {
    offers.push({
      '@type': 'Offer',
      price: fourPackPrice.toString(),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: `${baseUrl}/beer/${beerSlug}`,
      seller: {
        '@type': 'Organization',
        name: 'Lolev Beer',
        url: baseUrl
      }
    });
  }

  // If no offers with prices, don't add a priceless offer (Google requires price)
  return offers;
}

/**
 * Convert date string to ISO format (YYYY-MM-DD)
 */
function toISODate(dateStr: string): string | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

/**
 * Generate reviews from Untappd positive reviews
 */
function generateReviews(reviews: UntappdReview[]): ReviewJsonLd[] {
  return reviews.map((review) => {
    const reviewData: ReviewJsonLd = {
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.username,
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating.toFixed(1),
        bestRating: '5',
        worstRating: '1',
      },
      reviewBody: review.text,
    };

    if (review.date) {
      const isoDate = toISODate(review.date);
      if (isoDate) {
        reviewData.datePublished = isoDate;
      }
    }

    if (review.url) {
      reviewData.url = review.url;
    }

    return reviewData;
  });
}

/**
 * Generate additional properties for beer characteristics
 */
function generateAdditionalProperties(beer: Beer & { style?: unknown }): PropertyValueJsonLd[] {
  const properties: PropertyValueJsonLd[] = [];

  if (beer.abv) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Alcohol By Volume',
      value: `${beer.abv}%`
    });
  }

  const styleName = getBeerStyleName(beer);
  if (styleName && styleName !== 'Beer') {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Beer Style',
      value: styleName
    });
  }

  if (beer.recipe) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Recipe Number',
      value: beer.recipe
    });
  }

  if (beer.hops) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Hops',
      value: beer.hops
    });
  }

  return properties;
}

/**
 * Generate Product JSON-LD for a beer
 */
export function generateProductSchema(beer: Beer & { style?: unknown; slug?: string; draftPrice?: number; fourPack?: number }): ProductJsonLd {
  const baseUrl = 'https://lolev.beer';
  const styleName = getBeerStyleName(beer);
  const beerSlug = beer.slug || beer.variant || beer.id;

  const product: ProductJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: beer.name,
    description: beer.description || `${beer.name} - ${styleName} beer from Lolev Beer`,
    brand: {
      '@type': 'Brand',
      name: 'Lolev Beer',
      logo: `${baseUrl}/images/og-image.png`,
      url: baseUrl
    },
    category: getBeerCategory(beer),
    additionalProperty: generateAdditionalProperties(beer),
    sku: beerSlug
  };

  // Add image if available
  if (beer.image) {
    product.image = `${baseUrl}/images/beer/${beerSlug}.webp`;
  }

  // Add offers only if we have prices
  const offers = generateOffers(beer);
  if (offers.length > 0) {
    product.offers = offers;
  }

  // Add Untappd rating as aggregate rating
  if (beer.untappdRating && beer.untappdRating > 0) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: beer.untappdRating.toFixed(2),
      bestRating: '5',
      worstRating: '1',
      reviewCount: beer.untappdRatingCount ? String(beer.untappdRatingCount) : '1'
    };
  }

  // Add individual reviews
  if (beer.positiveReviews && beer.positiveReviews.length > 0) {
    product.review = generateReviews(beer.positiveReviews);
  }

  return product;
}

/**
 * Generate DrinkProduct schema (more specific than Product)
 * This is an alternative that's more semantic for beverages
 */
export function generateDrinkProductSchema(beer: Beer): object {
  const baseProduct = generateProductSchema(beer);

  return {
    ...baseProduct,
    '@type': ['Product', 'AlcoholicBeverage'],
    alcoholWarning: 'Alcoholic beverage. Must be 21+ to purchase.',
    manufacturer: {
      '@type': 'Organization',
      name: 'Lolev Beer',
      url: 'https://lolev.beer'
    }
  };
}

/**
 * ItemList schema for beer collection page
 * @see https://schema.org/ItemList
 * @see https://developers.google.com/search/docs/appearance/structured-data/carousel
 */
export interface ItemListJsonLd {
  '@context': 'https://schema.org';
  '@type': 'ItemList';
  name: string;
  description: string;
  numberOfItems: number;
  itemListElement: ItemListElementJsonLd[];
}

export interface ItemListElementJsonLd {
  '@type': 'ListItem';
  position: number;
  item: ProductJsonLd;
}

/**
 * Generate ItemList JSON-LD for beer collection page
 * This helps search engines display rich carousels of beers
 */
export function generateBeerListSchema(beers: (Beer & { slug?: string; draftPrice?: number; fourPack?: number })[]): ItemListJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Lolev Beer Collection',
    description: 'Explore our handcrafted selection of craft beers at Lolev Beer, a modern brewery in Pittsburgh.',
    numberOfItems: beers.length,
    itemListElement: beers.map((beer, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: generateProductSchema(beer)
    }))
  };
}
