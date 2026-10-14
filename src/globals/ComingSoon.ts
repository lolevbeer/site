import type { GlobalConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'

export const ComingSoon: GlobalConfig = {
  slug: 'coming-soon',
  label: 'Coming Soon Beers',
  admin: {
    group: 'Beer Catalog',
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
              label: 'Known beer (optional)',
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
              label: 'Planned style',
            },
          ],
        },
      ],
      label: 'Upcoming releases',
      admin: {
        description:
          'Choose a published beer, or leave Known beer blank and select a planned style. Adding a draft here does not publish it.',
      },
    },
  ],
}
