import type { CollectionConfig } from 'payload'
import {
  adminAccess,
  adminFieldAccess,
  adminOrSelfAccess,
  hasRole,
} from '@/src/access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // 7 days in seconds (7 * 24 * 60 * 60)
    tokenExpiration: 604800,
  },
  admin: {
    useAsTitle: 'email',
  },
  access: {
    read: adminOrSelfAccess,
    create: adminAccess,
    update: adminOrSelfAccess,
    delete: adminAccess,
    admin: ({ req: { user } }) => Boolean(user), // Must be logged in to access admin
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'locations',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
      admin: {
        description: 'Assign to specific locations. If set, bartenders can only access menus for these locations.',
        condition: (data) => data?.roles?.includes('bartender'),
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
        { label: 'Bartender', value: 'bartender' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Admins can manage users and all content. Event/Beer/Food Managers can manage their respective collections. Bartenders can update menus. Users can have multiple roles.',
      },
      access: {
        // Only admins can change roles
        update: adminFieldAccess,
      },
    },
    // Legacy field - kept for backwards compatibility during migration
    // Remove this field after all users have been migrated to 'roles'
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Event Manager', value: 'event-manager' },
        { label: 'Beer Manager', value: 'beer-manager' },
        { label: 'Food Manager', value: 'food-manager' },
        { label: 'Bartender', value: 'bartender' },
      ],
      admin: {
        hidden: true, // Hide from UI - only used for migration
        position: 'sidebar',
      },
    },
  ],
}
