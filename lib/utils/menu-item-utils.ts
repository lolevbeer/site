/**
 * Menu item utility functions
 * Handles extraction of beer/product data from polymorphic menu item relations
 */

import type { Beer as PayloadBeer, Product as PayloadProduct, Menu } from '@/src/payload-types'

/** Menu item from Payload Menu.items array */
type MenuItem = Menu['items'][number]

/** Polymorphic product field structure */
interface PolymorphicProduct {
  relationTo?: 'beers' | 'products'
  value?: PayloadBeer | PayloadProduct | string
}

/**
 * Extract a populated Beer object from a menu item
 *
 * Handles both:
 * - New polymorphic `product` field: { relationTo: 'beers', value: Beer }
 * - Legacy `beer` field (backwards compatibility)
 *
 * @param item - Menu item from Payload
 * @returns The Beer object if available and populated, null otherwise
 */
export function extractBeerFromMenuItem(item: MenuItem | Record<string, unknown>): PayloadBeer | null {
  // Handle new polymorphic product field
  if ('product' in item && item.product) {
    const product = item.product as PolymorphicProduct
    if (product.relationTo === 'beers' && typeof product.value === 'object' && product.value !== null) {
      return product.value as PayloadBeer
    }
  }

  // Backwards compatibility: old beer field
  if ('beer' in item && item.beer) {
    if (typeof item.beer === 'object' && item.beer !== null) {
      return item.beer as PayloadBeer
    }
  }

  return null
}

/**
 * Extract Beer ID from a menu item (useful for comparisons/lookups)
 *
 * Works whether the relation is populated (object) or just an ID (string)
 *
 * @param item - Menu item from Payload
 * @returns The Beer ID string if available, null otherwise
 */
export function extractBeerIdFromMenuItem(item: MenuItem | Record<string, unknown>): string | null {
  // Handle new polymorphic product field
  if ('product' in item && item.product) {
    const product = item.product as PolymorphicProduct
    if (product.relationTo === 'beers') {
      if (typeof product.value === 'string') return product.value
      if (typeof product.value === 'object' && product.value !== null && 'id' in product.value) {
        return (product.value as PayloadBeer).id
      }
    }
  }

  // Backwards compatibility: old beer field
  if ('beer' in item && item.beer) {
    if (typeof item.beer === 'string') return item.beer
    if (typeof item.beer === 'object' && item.beer !== null && 'id' in item.beer) {
      return (item.beer as PayloadBeer).id
    }
  }

  return null
}

/**
 * Extract a populated Product object from a menu item
 *
 * @param item - Menu item from Payload
 * @returns The Product object if available and populated, null otherwise
 */
export function extractProductFromMenuItem(item: MenuItem | Record<string, unknown>): PayloadProduct | null {
  if ('product' in item && item.product) {
    const product = item.product as PolymorphicProduct
    if (product.relationTo === 'products' && typeof product.value === 'object' && product.value !== null) {
      return product.value as PayloadProduct
    }
  }

  return null
}

/**
 * Check if a menu item contains a specific beer by ID
 *
 * @param item - Menu item from Payload
 * @param beerId - Beer ID to check for
 * @returns true if the menu item contains the specified beer
 */
export function menuItemHasBeer(item: MenuItem | Record<string, unknown>, beerId: string): boolean {
  return extractBeerIdFromMenuItem(item) === beerId
}
