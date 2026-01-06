import type { GlobalConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'

export const ComingSoon: GlobalConfig = {
  slug: 'coming-soon',
  label: 'Coming Soon',
  admin: {
    group: 'Back of House',
  },
  access: {
    read: () => true,
    update: adminAccess,
  },
  fields: [
    {
      name: 'beers',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'beer',
              type: 'relationship',
              relationTo: 'beers',
              admin: {
                description: 'Select the beer this entry refers to',
                width: '50%',
                sortOptions: 'name',
              },
            },
            {
              name: 'style',
              type: 'relationship',
              relationTo: 'styles',
              admin: {
                description: 'Select the beer style',
                condition: (data, siblingData) => !siblingData?.beer,
                width: '50%',
                sortOptions: 'name',
              },
            },
          ],
        },
      ],
    },
  ],
}
