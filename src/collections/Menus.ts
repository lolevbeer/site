import type { CollectionConfig, Access, Where } from 'payload'
import { APIError } from 'payload'
import { adminAccess, adminFieldAccess, hasRole, isAdmin } from '@/src/access/roles'
import { revalidateMenuCache } from '@/src/hooks/revalidate-menu'

/**
 * Get location IDs from user's assigned locations
 */
function getUserLocationIds(user: any): string[] | null {
  if (!user?.locations || !Array.isArray(user.locations) || user.locations.length === 0) {
    return null
  }
  return user.locations.map((loc: any) => (typeof loc === 'object' ? loc.id : loc))
}

const canUpdateMenus: Access = ({ req: { user } }) => {
  if (hasRole(user, 'admin')) return true
  if (hasRole(user, 'bartender')) {
    // If bartender has assigned locations, restrict to those locations' menus
    const locationIds = getUserLocationIds(user)
    if (locationIds) {
      return {
        location: {
          in: locationIds,
        },
      }
    }
    // Bartender without assigned locations can update all menus
    return true
  }
  return false
}

export const Menus: CollectionConfig = {
  slug: 'menus',
  admin: {
    group: 'Front of House',
    useAsTitle: 'description',
    hideAPIURL: true,
    defaultColumns: ['description', 'location', 'type', '_status'],
    preview: (doc) => {
      if (doc?.url) {
        return `/m/${doc.url}`
      }
      return ''
    },
  },
  access: {
    read: ({ req: { user } }): boolean | Where => {
      // Admins can read all menus (including drafts)
      if (hasRole(user, 'admin')) return true
      // Bartenders can read all menus, but if assigned to locations, only those locations' menus
      if (hasRole(user, 'bartender')) {
        const locationIds = getUserLocationIds(user)
        if (locationIds) {
          return {
            location: {
              in: locationIds,
            },
          }
        }
        return true
      }
      // Public can only read published menus
      return {
        _status: {
          equals: 'published',
        },
      }
    },
    create: adminAccess,
    update: canUpdateMenus,
    delete: adminAccess,
  },
  versions: {
    drafts: true,
    maxPerDoc: 50, // Keep only the last 50 versions per document
  },
  hooks: {
    afterChange: [revalidateMenuCache],
    beforeValidate: [
      ({ data }) => {
        if (!data?.items || !Array.isArray(data.items)) return data

        // Check for duplicate products (polymorphic - could be beer or product)
        const productIds = (
          data.items as Array<{ product?: { relationTo: string; value: string | { id?: string } } }>
        )
          .map((item) => {
            if (!item?.product) return null
            const value = item.product.value
            const id = typeof value === 'string' ? value : value?.id
            return `${item.product.relationTo}:${id}`
          })
          .filter(Boolean)

        const uniqueIds = new Set(productIds)
        if (uniqueIds.size !== productIds.length) {
          throw new APIError(
            'Duplicate item detected - each item can only appear once on the menu',
            400,
          )
        }

        return data
      },
    ],
    beforeChange: [
      async ({ data, req }) => {
        // Auto-generate URL if not provided or empty
        if ((!data.url || data.url.trim() === '') && data.location && data.type) {
          // Fetch location name
          let locationName = ''
          if (typeof data.location === 'string') {
            const location = await req.payload.findByID({
              collection: 'locations',
              id: data.location,
            })
            locationName = location.name || location.slug || ''
          } else if (data.location && typeof data.location === 'object') {
            locationName = data.location.name || data.location.slug || ''
          }

          // Generate slug from location-type
          const urlBase = `${locationName}-${data.type}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')

          data.url = urlBase
        }

        // Auto-sort items by recipe number (descending - newest first) for cans menus only
        if (data.type === 'cans' && data.items && Array.isArray(data.items)) {
          // Collect all beer IDs for batch query (fixes N+1)
          const beerIds: string[] = []
          const itemBeerMap: Map<number, string> = new Map()

          data.items.forEach((item: any, index: number) => {
            const product = item.product
            if (product?.relationTo === 'beers') {
              const beerId = typeof product.value === 'string' ? product.value : product.value?.id
              if (beerId) {
                beerIds.push(beerId)
                itemBeerMap.set(index, beerId)
              }
            }
          })

          // Single batch query for all beers
          const recipeMap: Map<string, number> = new Map()
          if (beerIds.length > 0) {
            const beers = await req.payload.find({
              collection: 'beers',
              where: { id: { in: beerIds } },
              limit: beerIds.length,
            })
            beers.docs.forEach((beer) => {
              recipeMap.set(beer.id, beer.recipe || 0)
            })
          }

          // Build items with recipe numbers
          const itemsWithRecipe = data.items.map((item: any, index: number) => {
            const beerId = itemBeerMap.get(index)
            if (beerId) {
              return { originalItem: item, recipe: recipeMap.get(beerId) || 0 }
            }
            // Products (non-beers) sort at the end
            return { originalItem: item, recipe: -1 }
          })

          // Sort by recipe number (descending)
          itemsWithRecipe.sort((a, b) => b.recipe - a.recipe)

          // Extract sorted items back to original structure
          data.items = itemsWithRecipe.map((item) => item.originalItem)
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      access: {
        update: adminFieldAccess,
      },
      admin: {
        description: 'Menu name (e.g., "Lawrenceville Draft Menu")',
        position: 'sidebar',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      access: {
        update: adminFieldAccess,
      },
      admin: {
        description: 'Menu description',
        position: 'sidebar',
      },
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: false,
      required: true,
      index: true,
      access: {
        update: adminFieldAccess,
      },
      admin: {
        position: 'sidebar',
        description: 'Required to generate menu URL',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Cans', value: 'cans' },
        { label: 'Draft', value: 'draft' },
        { label: 'Other', value: 'other' },
      ],
      index: true,
      access: {
        update: adminFieldAccess,
      },
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'url',
      label: 'URL',
      type: 'text',
      unique: true,
      index: true,
      required: true,
      access: {
        update: adminFieldAccess,
      },
      admin: {
        description: 'Auto-generated from location and type, but you can override it manually',
        position: 'sidebar',
      },
    },
    {
      name: 'sheetUrl',
      label: 'Google Sheet URL',
      type: 'text',
      access: {
        update: adminFieldAccess,
      },
      admin: {
        description: 'Google Sheets CSV export URL for syncing this menu (optional)',
        position: 'sidebar',
      },
    },
    {
      name: 'themeMode',
      label: 'Theme Mode',
      type: 'select',
      defaultValue: 'auto',
      options: [
        { label: 'Auto (Pittsburgh time)', value: 'auto' },
        { label: 'Always Light', value: 'light' },
        { label: 'Always Dark', value: 'dark' },
      ],
      access: {
        update: adminFieldAccess,
      },
      admin: {
        description: 'Override automatic day/night theme switching',
        position: 'sidebar',
      },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'product',
              type: 'relationship',
              relationTo: ['beers', 'products'],
              required: true,
              admin: {
                width: '66%',
                sortOptions: {
                  beers: 'name',
                  products: 'name',
                },
              },
            },
            {
              name: 'price',
              type: 'text',
              admin: {
                description: 'Sale Price (optional override)',
                width: '33%',
              },
            },
          ],
        },
      ],
    },
  ],
}
