import type { CollectionConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'

export const FAQs: CollectionConfig = {
  slug: 'faqs',
  access: {
    read: () => true, // Public can read FAQs
    create: adminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  admin: {
    group: 'Settings',
    useAsTitle: 'question',
    hideAPIURL: true,
    defaultColumns: ['question', 'order', 'active'],
    pagination: {
      defaultLimit: 50,
    },
    description: 'Additional FAQs that will be appended to the default FAQs on the FAQ page.',
  },
  fields: [
    {
      name: 'question',
      type: 'text',
      required: true,
      admin: {
        description: 'The question being asked',
      },
    },
    {
      name: 'answer',
      type: 'textarea',
      required: true,
      admin: {
        description: 'The answer to the question',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 100,
      admin: {
        description: 'Lower numbers appear first. Default FAQs start at 0, so use 100+ to append at the end.',
        position: 'sidebar',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Uncheck to hide this FAQ from the site',
        position: 'sidebar',
      },
    },
  ],
  defaultSort: 'order',
}
