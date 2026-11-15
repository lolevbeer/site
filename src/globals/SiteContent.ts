import { validateDistributorImportUrl } from '@/lib/distributors/import-source'
import type { Field, GlobalConfig } from 'payload'
import { adminAccess, adminFieldAccess } from '@/src/access/roles'
import { isSlackChannel } from '@/lib/slack/mrkdwn'
import { simpleEditor, syncPlainCopy } from '@/src/fields/rich-text'
import {
  DEFAULT_HERO_DESCRIPTION,
  DEFAULT_ABOUT_PHILOSOPHY,
  DEFAULT_ABOUT_LOCATIONS,
} from '@/lib/constants/site-content-defaults'

/**
 * A rich text field and the hidden plain-text copy it replaced. Staff edit the
 * rich field; `syncPlainCopy` (in `hooks` below) fills the copy, which builds
 * from before rich text still render.
 */
function richCopy(name: string, label: string, defaultText: string): Field[] {
  return [
    {
      name: `${name}Rich`,
      type: 'richText',
      label,
      editor: simpleEditor(),
      // No default here: Payload would fill a rich field the migration has not
      // reached with it, hiding the saved plain text. syncPlainCopy builds the
      // rich value from the plain default on a first save.
      admin: { description: 'Links, bold, italic and lists are allowed.' },
    },
    { name, type: 'textarea', defaultValue: defaultText, admin: { hidden: true } },
  ]
}

const RICH_COPY_FIELDS = ['heroDescription', 'aboutPhilosophy', 'aboutLocations']

export const SiteContent: GlobalConfig = {
  slug: 'site-content',
  label: 'Content',
  admin: {
    group: 'Website',
  },
  access: {
    read: () => true,
    update: adminAccess,
  },
  hooks: {
    beforeValidate: RICH_COPY_FIELDS.map((name) => syncPlainCopy(`${name}Rich`, name)),
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Homepage',
          fields: [
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Homepage background image',
              admin: {
                description:
                  'Background image for the homepage hero section (recommended: 1920x1080px or larger)',
              },
            },
            ...richCopy('heroDescription', 'Homepage introduction', DEFAULT_HERO_DESCRIPTION),
          ],
        },
        {
          label: 'About Page',
          fields: [
            ...richCopy('aboutPhilosophy', 'Our Philosophy', DEFAULT_ABOUT_PHILOSOPHY),
            ...richCopy('aboutLocations', 'Our Locations', DEFAULT_ABOUT_LOCATIONS),
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
          label: 'Slack Channels',
          description:
            'Where public-form pings post: #channel-name or a channel ID (C…). Invite the Lolev Beer bot to the channel, then use Send test message to confirm it can post. Blank uses the SLACK_*_CHANNEL env setting, else #events.',
          fields: [
            {
              name: 'slackChannels',
              type: 'group',
              label: false,
              access: { read: adminFieldAccess },
              fields: (
                [
                  ['donations', 'Donation requests'],
                  ['jobs', 'Job applications'],
                  ['eventInquiries', 'Private-event inquiries'],
                ] as const
              ).map(([name, label]) => ({
                name,
                label,
                type: 'text' as const,
                admin: {
                  components: {
                    afterInput: [
                      '@/src/components/admin/SlackChannelTestButton#SlackChannelTestButton',
                    ],
                  },
                },
                validate: (value: string | null | undefined) =>
                  !value?.trim() ||
                  isSlackChannel(value) ||
                  'Use #channel-name or a channel ID like C0123456789.',
              })),
            },
          ],
        },
        {
          label: 'Distributor Import',
          fields: [
            {
              name: 'distributorPaUrl',
              validate: validateDistributorImportUrl,
              type: 'text',
              label: 'Pennsylvania JSON URL',
              access: {
                read: adminFieldAccess,
              },
              admin: {
                description: 'Sarene/Encompass8 QuickLink URL for PA distributors',
              },
            },
            {
              name: 'distributorOhUrl',
              validate: validateDistributorImportUrl,
              type: 'text',
              label: 'Ohio JSON URL',
              access: {
                read: adminFieldAccess,
              },
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
