import type { CollectionConfig } from 'payload'
import { generateUniqueSlug } from './utils/generateUniqueSlug'

export const Locations: CollectionConfig = {
  slug: 'locations',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        // Compute slug from name
        if (data.name && typeof data.name === 'string') {
          data.slug = await generateUniqueSlug(
            data.name,
            'locations',
            req,
            operation,
            originalDoc?.id,
          )
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Is this location currently active?',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'slug',
      type: 'text',
      admin: {
        description: 'Auto-generated from name (lowercase, spaces to dashes)',
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'basicInfo',
      type: 'group',
      label: 'Contact Information',
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'phone',
          type: 'text',
        },
        {
          name: 'email',
          type: 'email',
        },
      ],
    },
    {
      name: 'address',
      type: 'group',
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'street',
          type: 'text',
        },
        {
          name: 'city',
          type: 'text',
        },
        {
          name: 'state',
          type: 'text',
        },
        {
          name: 'zip',
          type: 'text',
        },
      ],
    },
    {
      type: 'tabs',
      tabs: [
        {
          name: 'monday',
          label: 'Monday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'tuesday',
          label: 'Tuesday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'wednesday',
          label: 'Wednesday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'thursday',
          label: 'Thursday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'friday',
          label: 'Friday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'saturday',
          label: 'Saturday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'sunday',
          label: 'Sunday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
