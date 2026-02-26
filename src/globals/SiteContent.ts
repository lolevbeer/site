import type { GlobalConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'
import {
  DEFAULT_HERO_DESCRIPTION,
  DEFAULT_ABOUT_PHILOSOPHY,
  DEFAULT_ABOUT_LOCATIONS,
} from '@/lib/constants/site-content-defaults'

export const SiteContent: GlobalConfig = {
  slug: 'site-content',
  label: 'Site Content',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true,
    update: adminAccess,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Hero Section',
          fields: [
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Hero Background Image',
              admin: {
                description: 'Background image for the homepage hero section (recommended: 1920x1080px or larger)',
              },
            },
            {
              name: 'heroDescription',
              type: 'textarea',
              label: 'Hero Description',
              defaultValue: DEFAULT_HERO_DESCRIPTION,
              admin: {
                rows: 4,
              },
            },
          ],
        },
        {
          label: 'About Page',
          fields: [
            {
              name: 'aboutPhilosophy',
              type: 'textarea',
              label: 'Our Philosophy',
              defaultValue: DEFAULT_ABOUT_PHILOSOPHY,
              admin: {
                rows: 6,
              },
            },
            {
              name: 'aboutLocations',
              type: 'textarea',
              label: 'Our Locations',
              defaultValue: DEFAULT_ABOUT_LOCATIONS,
              admin: {
                rows: 6,
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
        {
          label: 'Distributor Import',
          fields: [
            {
              name: 'distributorPaUrl',
              type: 'text',
              label: 'Pennsylvania JSON URL',
              admin: {
                description: 'Sixth City/Encompass8 QuickLink URL for PA distributors',
              },
            },
            {
              name: 'distributorOhUrl',
              type: 'text',
              label: 'Ohio JSON URL',
              admin: {
                description: 'Sixth City/Encompass8 QuickLink URL for OH distributors',
              },
            },
          ],
        },
      ],
    },
  ],
}
