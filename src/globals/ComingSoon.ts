import type { GlobalConfig } from 'payload'

export const ComingSoon: GlobalConfig = {
  slug: 'coming-soon',
  label: 'Coming Soon',
  access: {
    read: () => true,
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
