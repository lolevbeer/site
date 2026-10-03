import type { AccessArgs, CollectionConfig, Access, Where } from 'payload'
import { APIError, appendVersionToQueryKey } from 'payload'
import type { User } from '@/src/payload-types'
import { adminAccess, adminFieldAccess, getUserLocationIds, hasRole } from '@/src/access/roles'
import { markLinesCleanedField } from './utils/markLinesCleanedField'
import { updatedByField } from './utils/updatedByField'

/**
 * Menus at the locations this user is assigned to, or `false` when they hold
 * none. Shared by `read` and `update`, which scope (lead) bartenders
 * identically — an unassigned bartender must be denied outright rather than
 * handed an empty filter that would match every menu.
 */
function menusAtAssignedLocations(user: User | null | undefined): Where | false {
  const locationIds = getUserLocationIds(user)
  if (locationIds.length === 0) return false

  return {
    location: {
      in: locationIds,
    },
  }
}

/**
 * Who may edit menus: admins anywhere and (lead) bartenders only at their
 * assigned locations. Exported because the Slack bot asks the
 * same question before opening its editor — `read` access falls through to
 * "published only" for everyone, so listing a menu proves nothing about being
 * able to publish it.
 */
export const canUpdateMenus: Access = ({ req: { user } }) => {
  if (hasRole(user, 'admin')) return true
  if (hasRole(user, ['bartender', 'lead-bartender'])) {
    return menusAtAssignedLocations(user)
  }
  return false
}

/**
 * Admins read every menu, drafts included; (lead) bartenders read drafts only
 * at their assigned locations; everyone else reads published menus only.
 */
const canReadMenus = ({ req: { user } }: AccessArgs): boolean | Where => {
  if (hasRole(user, 'admin')) return true
  if (hasRole(user, ['bartender', 'lead-bartender'])) {
    return menusAtAssignedLocations(user)
  }
  return {
    _status: {
      equals: 'published',
    },
  }
}

/**
 * Version history follows the same rule as `read`, mapped onto version
 * documents (`version.location`, `version._status`), and stays behind
 * sign-in: anonymous visitors never see past revisions.
 */
const canReadMenuVersions: Access = (args) => {
  if (!args.req.user) return false
  const result = canReadMenus(args)
  return typeof result === 'object' ? appendVersionToQueryKey(result) : result
}

export const Menus: CollectionConfig = {
  slug: 'menus',
  admin: {
    group: 'Front of House',
    useAsTitle: 'description',
    defaultColumns: ['description', 'location', 'type', '_status'],
    components: {
      views: {
        edit: {
          versions: { Component: '@/src/components/admin/VersionsWithEditor#VersionsWithEditor' },
        },
      },
    },
    preview: (doc) => {
      if (doc?.url) {
        return `/m/${doc.url}`
      }
      return ''
    },
  },
  access: {
    read: canReadMenus,
    readVersions: canReadMenuVersions,
    create: adminAccess,
    update: canUpdateMenus,
    delete: adminAccess,
  },
  versions: {
    drafts: true,
    maxPerDoc: 1000, // ~1.5 KB each, so ~1.5 MB per menu; feeds the menu-target-history widget
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data?.items || !Array.isArray(data.items)) return data

        // Check for duplicate products (polymorphic - could be beer or product)
        // Skip empty slots (items without a product) which represent empty taps
        const productIds = (
          data.items as Array<{
            product?: { relationTo: string; value: string | { id?: string } } | null
          }>
        )
          .map((item) => {
            if (!item?.product) return null
            const value = item.product.value
            const id = typeof value === 'string' ? value : value?.id
            if (!id) return null
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
          // Fetch location name as the editor (locations are publicly readable)
          let locationName = ''
          if (typeof data.location === 'string') {
            const location = await req.payload.findByID({
              collection: 'locations',
              id: data.location,
              req,
              overrideAccess: false,
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

          data.items.forEach(
            (
              item: { product?: { relationTo: string; value: string | { id?: string } } | null },
              index: number,
            ) => {
              const product = item.product
              if (product?.relationTo === 'beers') {
                const beerId = typeof product.value === 'string' ? product.value : product.value?.id
                if (beerId) {
                  beerIds.push(beerId)
                  itemBeerMap.set(index, beerId)
                }
              }
            },
          )

          // Single batch query for all beers, run as the editor inside the
          // save transaction. Menu editors (admin, bartender, lead-bartender)
          // read every beer incl. drafts via canReadBeers.
          const recipeMap: Map<string, number> = new Map()
          if (beerIds.length > 0) {
            const beers = await req.payload.find({
              collection: 'beers',
              where: { id: { in: beerIds } },
              limit: beerIds.length,
              req,
              overrideAccess: false,
            })
            beers.docs.forEach((beer) => {
              recipeMap.set(beer.id, beer.recipe || 0)
            })
          }

          // Build items with recipe numbers
          const itemsWithRecipe = data.items.map(
            (
              item: { product?: { relationTo: string; value: string | { id?: string } } | null },
              index: number,
            ) => {
              const beerId = itemBeerMap.get(index)
              if (beerId) {
                return { originalItem: item, recipe: recipeMap.get(beerId) || 0 }
              }
              // Products (non-beers) sort at the end
              return { originalItem: item, recipe: -1 }
            },
          )

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
    markLinesCleanedField({ showFor: (data) => data?.type === 'draft' }),
    updatedByField,
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
      name: 'animateCans',
      label: 'Animate Cans',
      type: 'checkbox',
      defaultValue: true,
      access: {
        update: adminFieldAccess,
      },
      admin: {
        position: 'sidebar',
        // Only cans menus render the rotating-can sprite sheets, so the toggle
        // is irrelevant on draft/other menus.
        condition: (data) => data?.type === 'cans',
        description:
          'Play the rotating-can animation on this display. Turn off to show static can images instead.',
      },
    },
    {
      name: 'targetItemCount',
      label: 'Target Item Count',
      type: 'number',
      min: 0,
      defaultValue: 10,
      access: {
        update: adminFieldAccess,
      },
      admin: {
        position: 'sidebar',
        condition: (data) => data?.type === 'cans' || data?.type === 'draft',
        description: 'Ideal number of cans or draft lines on this menu',
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
              required: false,
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
        {
          name: 'promotion',
          type: 'text',
          maxLength: 60,
          admin: {
            condition: (data) => data?.type === 'cans',
            description: 'Optional promotion shown only on the fullscreen can menu.',
          },
        },
      ],
    },
  ],
}
