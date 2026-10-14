import type { AccessArgs, CollectionConfig, Access, Where } from 'payload'
import { APIError, appendVersionToQueryKey } from 'payload'
import type { User } from '@/src/payload-types'
import { adminAccess, adminFieldAccess, getUserLocationIds, hasRole } from '@/src/access/roles'
import { markLinesCleanedField } from './utils/markLinesCleanedField'
import { updatedByField } from './utils/updatedByField'
import { DEFAULT_TARGET, TARGETED_MENU_TYPES } from '@/lib/utils/menu-target'

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
    group: 'Taproom Operations',
    useAsTitle: 'name',
    defaultColumns: ['name', 'location', 'type', '_status', 'updatedAt'],
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
      label: 'Menu name',
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
      label: 'Taproom',
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
      label: 'Menu type',
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Menu items',
          fields: [
            {
              name: 'items',
              type: 'array',
              required: true,
              admin: {
                initCollapsed: false,
                description:
                  'Leave a product blank for an empty tap. Items may appear only once. Cans save newest recipe first, followed by other items.',
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
                      label: 'Beer / other menu item',
                    },
                    {
                      name: 'price',
                      type: 'text',
                      admin: {
                        description: 'Blank means no override; use the catalog price.',
                        width: '33%',
                      },
                      label: 'Display price override',
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
                  label: 'Promotion text',
                },
              ],
            },
          ],
        },
        {
          label: 'Display settings',
          fields: [
            {
              name: 'description',
              type: 'textarea',
              access: {
                update: adminFieldAccess,
              },
              admin: {
                description:
                  'Optional page/social description. Also used as the menu label in Slack when set; not shown on the menu board.',
                position: undefined,
              },
            },
            {
              name: 'url',
              label: 'Menu URL slug',
              type: 'text',
              unique: true,
              index: true,
              required: true,
              access: {
                update: adminFieldAccess,
              },
              admin: {
                description:
                  'Auto-generated from location and type, but you can override it manually',
                position: undefined,
              },
            },
            {
              name: 'themeMode',
              label: 'Display theme',
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
                position: undefined,
              },
            },
            {
              name: 'animateCans',
              label: 'Animate cans',
              type: 'checkbox',
              defaultValue: true,
              access: {
                update: adminFieldAccess,
              },
              admin: {
                position: undefined,
                // Only cans menus render the rotating-can sprite sheets, so the toggle
                // is irrelevant on draft/other menus.
                condition: (data) => data?.type === 'cans',
                description:
                  'Play the rotating-can animation on this display. Turn off to show static can images instead.',
              },
            },
            {
              name: 'targetItemCount',
              label: 'Target stocked items',
              type: 'number',
              min: 0,
              defaultValue: DEFAULT_TARGET,
              access: {
                update: adminFieldAccess,
              },
              admin: {
                position: undefined,
                condition: (data) => TARGETED_MENU_TYPES.includes(data?.type),
                description:
                  'Ideal stocked count, not an enforced maximum or the number of empty tap rows.',
              },
            },
          ],
        },
      ],
    },
  ],
}
