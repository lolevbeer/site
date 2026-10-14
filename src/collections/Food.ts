import type { CollectionConfig } from 'payload'
import { foodManagerAccess } from '@/src/access/roles'

export const Food: CollectionConfig = {
  slug: 'food',
  access: {
    read: () => true,
    create: foodManagerAccess,
    update: foodManagerAccess,
    delete: foodManagerAccess,
  },
  labels: { singular: 'Food Booking', plural: 'One-off Food Bookings' },
  admin: {
    group: 'Food & Events',
    useAsTitle: 'vendorName',
    defaultColumns: ['vendor', 'date', 'location', 'startTime'],
    pagination: {
      defaultLimit: 100,
    },
    description:
      'Dated vendor bookings. To replace recurring food, also skip that recurring date in Recurring Food Schedule.',
  },
  fields: [
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
              // As the editor; food vendors (and their name) are publicly readable.
              const vendorDoc = await req.payload.findByID({
                collection: 'food-vendors',
                id: typeof data.vendor === 'object' ? data.vendor.id : data.vendor,
                req,
                overrideAccess: false,
              })
              return vendorDoc?.name || ''
            }
            return ''
          },
        ],
      },
    },
    {
      name: 'vendor',
      type: 'relationship',
      relationTo: 'food-vendors',
      required: true,
      index: true,
      admin: {
        description: 'Food vendor serving on this date.',
        sortOptions: 'name',
      },
      label: 'Vendor',
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      required: true,
      hasMany: false,
      index: true,
      label: 'Taproom',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'date',
          type: 'date',
          required: true,
          index: true,
          admin: {
            position: undefined,
            date: {
              displayFormat: 'MMM d, yyyy',
            },
            width: '50%',
          },
          label: 'Service date',
        },
        {
          name: 'startTime',
          type: 'date',
          admin: {
            position: undefined,
            date: {
              pickerAppearance: 'timeOnly',
              displayFormat: 'h:mm a',
            },
            width: '50%',
          },
          label: 'Start time',
        },
      ],
    },
    {
      name: 'dateWarning',
      type: 'ui',
      admin: {
        components: {
          Field: '@/src/components/FoodDateWarning#FoodDateWarning',
        },
      },
    },
  ],
}
