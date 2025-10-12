/**
 * Product schema generation for beer products
 * Helps with product discovery and rich snippets
 * @see https://schema.org/Product
 * @see https://developers.google.com/search/docs/appearance/structured-data/product
 */

import { Beer } from '@/lib/types/beer';

/**
 * Schema.org Product type
 */
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
 * Get availability status based on beer data
 */
function getAvailabilityStatus(beer: Beer): string {
  // If on draft at either location
  if (beer.lawrencevilleDraft || beer.zelienopleDraft) {
    return 'https://schema.org/InStock';
  }

  // If available in cans
  if (beer.lawrencevilleCans || beer.zelienopleCans) {
    return 'https://schema.org/InStock';
  }

  // Otherwise out of stock
  return 'https://schema.org/OutOfStock';
}

/**
 * Get beer category/style
 */
function getBeerCategory(beer: Beer): string {
  const type = beer.type || 'Beer';
  return `Craft Beer > ${type}`;
}

/**
 * Generate offers array for a beer
 */
function generateOffers(beer: Beer): OfferJsonLd[] {
  const offers: OfferJsonLd[] = [];
  const baseUrl = 'https://lolev.beer';

  // Draft offers
  if (beer.lawrencevilleDraft || beer.zelienopleDraft) {
    offers.push({
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      priceCurrency: 'USD',
      itemCondition: 'https://schema.org/NewCondition',
      url: `${baseUrl}/beer/${beer.variant}`,
      seller: {
        '@type': 'Organization',
        name: 'Lolev Beer',
        url: baseUrl
      }
    });
  }

  // Can offers with pricing
  if (beer.canPrice && (beer.lawrencevilleCans || beer.zelienopleCans)) {
    // Parse price (e.g., "$16" or "16")
    const priceMatch = beer.canPrice.toString().match(/\$?(\d+(?:\.\d{2})?)/);
    if (priceMatch) {
      offers.push({
        '@type': 'Offer',
        price: priceMatch[1],
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: `${baseUrl}/beer/${beer.variant}`,
        seller: {
          '@type': 'Organization',
          name: 'Lolev Beer',
          url: baseUrl
        }
      });
    }
  }

  // If no specific offers, add generic availability
  if (offers.length === 0) {
    offers.push({
      '@type': 'Offer',
      availability: getAvailabilityStatus(beer),
      priceCurrency: 'USD',
      url: `${baseUrl}/beer/${beer.variant}`,
      seller: {
        '@type': 'Organization',
        name: 'Lolev Beer',
        url: baseUrl
      }
    });
  }

  return offers;
}

/**
 * Generate additional properties for beer characteristics
 */
function generateAdditionalProperties(beer: Beer): PropertyValueJsonLd[] {
  const properties: PropertyValueJsonLd[] = [];

  if (beer.abv) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Alcohol By Volume',
      value: `${beer.abv}%`
    });
  }

  if (beer.ibu) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'International Bitterness Units',
      value: beer.ibu
    });
  }

  if (beer.style) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Beer Style',
      value: beer.style
    });
  }

  if (beer.recipeNumber) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Recipe Number',
      value: beer.recipeNumber
    });
  }

  return properties;
}

/**
 * Generate Product JSON-LD for a beer
 */
export function generateProductSchema(beer: Beer): ProductJsonLd {
  const baseUrl = 'https://lolev.beer';

  const product: ProductJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: beer.name,
    description: beer.description || `${beer.name} - ${beer.type} beer from Lolev Beer`,
    brand: {
      '@type': 'Brand',
      name: 'Lolev Beer',
      logo: `${baseUrl}/images/og-image.jpg`,
      url: baseUrl
    },
    category: getBeerCategory(beer),
    offers: generateOffers(beer),
    additionalProperty: generateAdditionalProperties(beer),
    sku: beer.variant
  };

  // Add image if available
  if (beer.image) {
    product.image = `${baseUrl}/images/beer/${beer.variant}.webp`;
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
