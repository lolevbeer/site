import type { CollectionConfig, Access } from 'payload'
import { APIError } from 'payload'

const isAdminOrEditor: Access = ({ req: { user } }) => {
  return user?.role === 'admin' || user?.role === 'editor'
}

export const Menus: CollectionConfig = {
  slug: 'menus',
  admin: {
    useAsTitle: 'description',
    defaultColumns: ['description', 'location', 'type', '_status'],
    preview: (doc) => {
      if (doc?.url) {
        return `/m/${doc.url}`
      }
      return ''
    },
  },
  access: {
    read: ({ req: { user } }) => {
      // Admins/editors can read all menus (including drafts)
      if (user?.role === 'admin' || user?.role === 'editor') {
        return true
      }
      // Public can only read published menus
      return {
        _status: {
          equals: 'published',
        },
      }
    },
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  versions: {
    drafts: true,
    maxPerDoc: 50, // Keep only the last 50 versions per document
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data?.items || !Array.isArray(data.items)) return data

        const beerIds = (data.items as Array<{ beer?: string | { id?: string } }>)
          .map((item) => {
            if (!item?.beer) return null
            return typeof item.beer === 'string' ? item.beer : item.beer?.id
          })
          .filter(Boolean)

        const uniqueIds = new Set(beerIds)
        if (uniqueIds.size !== beerIds.length) {
          throw new APIError('Duplicate beer detected - each beer can only appear once on the menu', 400)
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
          // Fetch full beer data for sorting but preserve original item structure
          const itemsWithRecipe = await Promise.all(
            data.items.map(async (item: any) => {
              const beerId = typeof item.beer === 'string' ? item.beer : item.beer?.id
              if (beerId) {
                try {
                  const beer = await req.payload.findByID({
                    collection: 'beers',
                    id: beerId,
                  })
                  return {
                    originalItem: item,
                    recipe: beer?.recipe || 0,
                  }
                } catch (_error) {
                  return {
                    originalItem: item,
                    recipe: 0,
                  }
                }
              }
              return {
                originalItem: item,
                recipe: 0,
              }
            }),
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
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Menu name (e.g., "Lawrenceville Draft Menu")',
        position: 'sidebar',
      },
    },
    {
      name: 'description',
      type: 'textarea',
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
      admin: {
        description: 'Auto-generated from location and type, but you can override it manually',
        position: 'sidebar',
      },
    },
    {
      name: 'sheetUrl',
      label: 'Google Sheet URL',
      type: 'text',
      admin: {
        description: 'Google Sheets CSV export URL for syncing this menu (optional)',
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
              name: 'beer',
              type: 'relationship',
              relationTo: 'beers',
              required: true,
              admin: {
                width: '66%',
                sortOptions: 'name',
                allowCreate: false,
                description: 'Search by name or slug',
              },
            },
            {
              name: 'price',
              type: 'text',
              admin: {
                description: 'Sale Price',
                width: '33%',
              },
            },
          ],
        },
      ],
    },
  ],
}
