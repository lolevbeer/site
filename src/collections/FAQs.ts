import type { CollectionConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'
import { simpleEditor, syncPlainCopy } from '@/src/fields/rich-text'

export const FAQs: CollectionConfig = {
  slug: 'faqs',
  // Admin deletes go to the trash and can be restored (#368).
  trash: true,
  access: {
    read: () => true, // Public can read FAQs
    create: adminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  admin: {
    group: 'Website',
    useAsTitle: 'question',
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
      name: 'answerRich',
      type: 'richText',
      label: 'Answer',
      required: true,
      // Under the question, which the accordion renders as an h3.
      editor: simpleEditor(['h4']),
      admin: {
        description: 'The answer to the question. A small heading, links, bold, italic and lists are allowed.',
      },
    },
    {
      // Plain-text copy of answerRich, filled by syncPlainCopy. Read by the FAQ
      // structured data, llms-full.txt and builds from before rich text (#375).
      name: 'answer',
      type: 'textarea',
      required: true,
      admin: { hidden: true },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 100,
      admin: {
        description:
          'Lower numbers appear first. Default FAQs start at 0, so use 100+ to append at the end.',
        position: 'sidebar',
      },
      label: 'Display order',
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Uncheck to hide this FAQ from the site',
        position: 'sidebar',
      },
      label: 'Show on website',
    },
  ],
  hooks: { beforeValidate: [syncPlainCopy('answerRich', 'answer')] },
  defaultSort: 'order',
  labels: { singular: 'FAQ', plural: 'FAQs' },
}
