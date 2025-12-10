import type { CollectionConfig, Access, FieldAccess } from 'payload'

// Check if user is an admin (collection-level)
const isAdmin: Access = ({ req: { user } }) => {
  return user?.role === 'admin'
}

// Check if user is an admin (field-level)
const isAdminField: FieldAccess = ({ req: { user } }) => {
  return user?.role === 'admin'
}

// Check if user is admin or editor (currently unused but available for future use)
const _isAdminOrEditor: Access = ({ req: { user } }) => {
  return user?.role === 'admin' || user?.role === 'editor'
}

// Check if user is accessing their own record
const isAdminOrSelf: Access = ({ req: { user }, id }) => {
  if (user?.role === 'admin') return true
  return user?.id === id
}

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
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
    admin: ({ req: { user } }) => Boolean(user), // Must be logged in to access admin
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      admin: {
        description: 'Admins can manage users and all content. Editors can manage content only.',
      },
      access: {
        // Only admins can change roles
        update: isAdminField,
      },
    },
  ],
}
