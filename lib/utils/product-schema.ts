/**
 * Product schema generation for beer products
 * Helps with product discovery and rich snippets
 * @see https://schema.org/Product
 * @see https://developers.google.com/search/docs/appearance/structured-data/product
 */

import type { Beer as PayloadBeer } from '@/src/payload-types'
import { Beer } from '@/lib/types/beer'
import { getBeerImageUrl } from '@/lib/utils/media-utils'
import { LOLEV_BASE_URL, LOLEV_OG_IMAGE_URL } from '@/lib/utils/schema-shared'
import { relationshipName } from '@/lib/utils/relationship-name'

/**
 * Schema.org Product type
 */
export interface ReviewJsonLd {
  '@type': 'Review'
  author: {
    '@type': 'Person'
    name: string
  }
  reviewRating: {
    '@type': 'Rating'
    ratingValue: string
    bestRating: string
    worstRating: string
  }
  reviewBody: string
  datePublished?: string
  url?: string
}

export interface ProductJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Product'
  name: string
  description?: string
  image?: string | string[]
  brand: BrandJsonLd
  category?: string
  offers?: OfferJsonLd | OfferJsonLd[]
  aggregateRating?: AggregateRatingJsonLd
  review?: ReviewJsonLd[]
  additionalProperty?: PropertyValueJsonLd[]
  sku?: string
  gtin?: string
}

export interface BrandJsonLd {
  '@type': 'Brand'
  name: string
  logo?: string
  url?: string
}

export interface OfferJsonLd {
  '@type': 'Offer'
  name?: string
  price?: string
  priceCurrency?: string
  availability: string
  url?: string
  seller?: OrganizationJsonLd
  priceValidUntil?: string
  itemCondition?: string
}

export interface OrganizationJsonLd {
  '@type': 'Organization'
  name: string
  url?: string
}

export interface AggregateRatingJsonLd {
  '@type': 'AggregateRating'
  ratingValue: string
  reviewCount: string
  bestRating?: string
  worstRating?: string
}

export interface PropertyValueJsonLd {
  '@type': 'PropertyValue'
  name: string
  value: string | number
}

/**
 * Input type for product schema generation.
 * Accepts either a Payload CMS Beer or the app-level Beer interface.
 */
type ProductSchemaInput =
  (Beer & { style?: unknown; slug?: string; draftPrice?: number; fourPack?: number }) | PayloadBeer

/**
 * Get beer style name from either type field or style relationship
 */
function getBeerStyleName(beer: ProductSchemaInput): string {
  // Check for type field (app Beer interface)
  if ('type' in beer && beer.type && typeof beer.type === 'string') {
    return beer.type
  }
  // Check for style relationship (Payload beer)
  return relationshipName('style' in beer ? beer.style : undefined) ?? 'Beer'
}

export interface ProductSchemaOptions {
  /** True when the beer is on a current draft or cans menu. */
  inStock?: boolean
}

function offerAvailability(inStock: boolean | undefined): string {
  if (inStock === true) return 'https://schema.org/InStock'
  if (inStock === false) return 'https://schema.org/OutOfStock'
  return 'https://schema.org/LimitedAvailability'
}

function productUrlSlug(beer: ProductSchemaInput) {
  return (
    ('slug' in beer ? beer.slug : undefined) ||
    ('variant' in beer ? beer.variant : undefined) ||
    beer.id
  )
}

/**
 * Generate offers array for a beer
 */
function generateOffers(beer: ProductSchemaInput, inStock?: boolean): OfferJsonLd[] {
  const offers: OfferJsonLd[] = []

  // Rolling 90-day validity so Google doesn't warn about missing priceValidUntil.
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 90)
  const priceValidUntil = validUntil.toISOString().split('T')[0]
  const beerSlug = productUrlSlug(beer)

  const draftPrice = beer.draftPrice || ('pricing' in beer ? beer.pricing?.draftPrice : undefined)
  const fourPackPrice =
    ('fourPack' in beer ? beer.fourPack : undefined) ||
    ('pricing' in beer ? beer.pricing?.fourPack : undefined)

  const buildOffer = (price: number, name: string): OfferJsonLd => ({
    '@type': 'Offer',
    name,
    price: price.toString(),
    priceCurrency: 'USD',
    availability: offerAvailability(inStock),
    itemCondition: 'https://schema.org/NewCondition',
    priceValidUntil,
    url: `${LOLEV_BASE_URL}/beer/${beerSlug}`,
    seller: {
      '@type': 'Organization',
      name: 'Lolev Beer',
      url: LOLEV_BASE_URL,
    },
  })

  if (draftPrice) {
    offers.push(buildOffer(draftPrice, 'Draft pour'))
  }

  if (fourPackPrice) {
    offers.push(buildOffer(fourPackPrice, '4-pack'))
  }

  return offers
}

/**
 * Generate additional properties for beer characteristics
 */
function generateAdditionalProperties(beer: ProductSchemaInput): PropertyValueJsonLd[] {
  const properties: PropertyValueJsonLd[] = []

  if (beer.abv) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Alcohol By Volume',
      value: `${beer.abv}%`,
    })
  }

  const styleName = getBeerStyleName(beer)
  if (styleName && styleName !== 'Beer') {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Beer Style',
      value: styleName,
    })
  }

  if (beer.recipe) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Recipe Number',
      value: beer.recipe,
    })
  }

  if (beer.hops) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Hops',
      value: beer.hops,
    })
  }

  return properties
}

/**
 * Generate Product JSON-LD for a beer
 */
export function generateProductSchema(
  beer: ProductSchemaInput,
  options: ProductSchemaOptions = {},
): ProductJsonLd {
  const styleName = getBeerStyleName(beer)
  const beerSlug = productUrlSlug(beer)

  const product: ProductJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: beer.name,
    description: beer.description || `${beer.name} - ${styleName} beer from Lolev Beer`,
    brand: {
      '@type': 'Brand',
      name: 'Lolev Beer',
      logo: LOLEV_OG_IMAGE_URL,
      url: LOLEV_BASE_URL,
    },
    category: `Craft Beer > ${styleName}`,
    additionalProperty: generateAdditionalProperties(beer),
    sku: beerSlug,
  }

  // Add image if available. Resolve the real URL (local PNG, Payload Media, or
  // Blob) via the shared helper, then make it absolute for schema.org.
  const imageUrl = getBeerImageUrl(beer.image, typeof beerSlug === 'string' ? beerSlug : undefined)
  if (imageUrl) {
    product.image = imageUrl.startsWith('/') ? `${LOLEV_BASE_URL}${imageUrl}` : imageUrl
  }

  const offers = generateOffers(beer, options.inStock)
  if (offers.length > 0) {
    product.offers = offers
  }

  // Untappd aggregate only — do not nest a shorter Review[] that disagrees
  // with reviewCount. The visible reviews stay on the page.
  if (beer.untappdRating && beer.untappdRating > 0) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: beer.untappdRating.toFixed(2),
      bestRating: '5',
      worstRating: '1',
      reviewCount: beer.untappdRatingCount ? String(beer.untappdRatingCount) : '1',
    }
  }

  return product
}

/**
 * ItemList schema for beer collection page
 * @see https://schema.org/ItemList
 * @see https://developers.google.com/search/docs/appearance/structured-data/carousel
 */
export interface ItemListJsonLd {
  '@context': 'https://schema.org'
  '@type': 'ItemList'
  name: string
  description: string
  numberOfItems: number
  itemListElement: ItemListElementJsonLd[]
}

export interface ItemListElementJsonLd {
  '@type': 'ListItem'
  position: number
  name?: string
  url?: string
  item?: ProductJsonLd
}

/**
 * Generate ItemList JSON-LD for the beer collection page.
 * Elements are URLs (not nested Product graphs) so the catalog HTML stays small
 * and availability claims live only on each beer page.
 */
export function generateBeerListSchema(beers: ProductSchemaInput[]): ItemListJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Lolev Beer Collection',
    description:
      'Explore our handcrafted selection of craft beers at Lolev Beer, a modern brewery in Pittsburgh.',
    numberOfItems: beers.length,
    itemListElement: beers.map((beer, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: beer.name,
      url: `${LOLEV_BASE_URL}/beer/${productUrlSlug(beer)}`,
    })),
  }
}
