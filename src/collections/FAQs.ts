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
    defaultColumns: ['question', 'order', 'active'],
    pagination: {
      defaultLimit: 50,
    },
    description:
      'A FAQ whose question matches a default FAQ (ignoring case and extra spaces) replaces that default answer in place, keeping the default position. Other FAQs are appended after the defaults, sorted by Order.',
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
        description:
          'Orders only FAQs that do not match a default question; they always follow the defaults. A FAQ that overrides a default keeps the default position.',
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
