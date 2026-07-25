import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import {
  adminAccess,
  adminFieldAccess,
  adminOrSelfAccess,
  hasRole,
  isAdmin,
  leadBartenderAccess,
} from '@/src/access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // 7 days in seconds (7 * 24 * 60 * 60)
    tokenExpiration: 604800,
  },
  admin: {
    group: 'Settings',
    useAsTitle: 'email',
    hideAPIURL: true,
  },
  access: {
    read: adminOrSelfAccess,
    create: leadBartenderAccess,
    update: adminOrSelfAccess,
    delete: adminAccess,
    admin: ({ req: { user } }) => Boolean(user), // Must be logged in to access admin
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation !== 'create') return data
        if (isAdmin(req.user)) return data
        if (!hasRole(req.user, 'lead-bartender')) return data

        // Lead bartenders can only create users with 'bartender' role
        const roles: string[] = data.roles || []
        const onlyBartenderRole = roles.length > 0 && roles.every((role) => role === 'bartender')

        if (!onlyBartenderRole) {
          throw new APIError('Lead Bartenders can only create users with the Bartender role', 403)
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      admin: {
        position: 'sidebar',
      },
    },
    {
      // Links a Slack account to this user so the /lolevbeer bot can act as
      // them (see src/app/api/slack/route.ts). Claimed automatically the first
      // time a Slack profile email matches this user's email; set it by hand
      // when the two differ. Unique so two users can't map to one Slack account.
      name: 'slackUserId',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Slack member ID (e.g. U01ABCDEF). Filled in automatically when the Slack profile email matches this account — set it manually only if the emails differ.',
      },
      access: {
        // Self-claim is a system write (overrideAccess); only admins may
        // retarget an existing mapping, which would hand over this account.
        update: adminFieldAccess,
      },
    },
    {
      name: 'locations',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
      admin: {
        description: 'Assign to specific locations. If set, bartenders can only access menus for these locations.',
        condition: (data) => data?.roles?.includes('bartender') || data?.roles?.includes('lead-bartender'),
      },
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['bartender'],
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Event Manager', value: 'event-manager' },
        { label: 'Beer Manager', value: 'beer-manager' },
        { label: 'Food Manager', value: 'food-manager' },
        { label: 'Lead Bartender', value: 'lead-bartender' },
        { label: 'Bartender', value: 'bartender' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Admins can manage users and all content. Event/Beer/Food Managers can manage their respective collections. Lead Bartenders can update line cleaning dates. Bartenders can update menus. Users can have multiple roles.',
      },
      access: {
        // Lead bartenders can set roles on create (validated by hook to only allow 'bartender')
        // Only admins can change roles on existing users
        create: ({ req: { user } }) => hasRole(user, ['admin', 'lead-bartender']),
        update: adminFieldAccess,
      },
    },
  ],
}
