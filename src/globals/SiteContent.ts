import type { GlobalConfig } from 'payload'

export const SiteContent: GlobalConfig = {
  slug: 'site-content',
  label: 'Site Content',
  access: {
    read: () => true,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Hero Section',
          fields: [
            {
              name: 'heroDescription',
              type: 'textarea',
              label: 'Hero Description',
              defaultValue: "Brewed in Pittsburgh's vibrant Lawrenceville neighborhood, housed in a historic building that has stood since 1912. Lolev focuses on modern ales, expressive lagers and oak-aged beer.\n\nWe believe that beer should be thoughtful and stimulating. Each beer we create is intended to engage your senses, crafted with attention to flavor, balance, and the experience.",
              admin: {
                rows: 4,
              },
            },
          ],
        },
        {
          label: 'Messages',
          fields: [
            {
              name: 'errorMessage',
              type: 'text',
              label: 'Error Message',
              defaultValue: "We encountered an unexpected error. Don't worry, your data is safe.",
            },
            {
              name: 'todaysEventsTitle',
              type: 'text',
              label: "Today's Events Title",
              defaultValue: "Today's Event",
            },
            {
              name: 'todaysFoodTitle',
              type: 'text',
              label: "Today's Food Title",
              defaultValue: "Today's Food",
            },
          ],
        },
      ],
    },
  ],
}
