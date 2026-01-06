import type { CollectionConfig } from 'payload'
import { foodManagerAccess, isAdmin } from '@/src/access/roles'

export const Food: CollectionConfig = {
  slug: 'food',
  access: {
    read: () => true,
    create: foodManagerAccess,
    update: foodManagerAccess,
    delete: foodManagerAccess,
  },
  labels: {
    singular: 'Food',
    plural: 'Food',
  },
  admin: {
    group: 'Food & Events',
    useAsTitle: 'vendorName',
    hideAPIURL: true,
    defaultColumns: ['vendor', 'date', 'location', 'startTime'],
    pagination: {
      defaultLimit: 100,
    },
  },
  fields: [
    {
      name: 'vendor',
      type: 'relationship',
      relationTo: 'food-vendors',
      required: true,
      index: true,
      admin: {
        description: 'Select food vendor',
        sortOptions: 'name',
      },
    },
    {
      name: 'vendorName',
      type: 'text',
      admin: {
        hidden: true,
        description: 'Auto-populated vendor name for display',
      },
      hooks: {
        beforeChange: [
          async ({ data, req }) => {
            if (data?.vendor) {
              const vendorDoc = await req.payload.findByID({
                collection: 'food-vendors',
                id: typeof data.vendor === 'object' ? data.vendor.id : data.vendor,
              })
              return vendorDoc?.name || ''
            }
            return ''
          },
        ],
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        date: {
          displayFormat: 'MMM d, yyyy',
        },
      },
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      required: true,
      hasMany: false,
      index: true,
    },
    {
      name: 'startTime',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'timeOnly',
          displayFormat: 'h:mm a',
        },
      },
    },
    {
      name: 'dateWarning',
      type: 'ui',
      admin: {
        components: {
          Field: './components/FoodDateWarning#FoodDateWarning',
        },
      },
    },
  ],
}
