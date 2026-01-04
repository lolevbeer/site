import type { GlobalConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'

export const DistributorSettings: GlobalConfig = {
  slug: 'distributor-settings',
  label: 'Distributor Settings',
  admin: {
    group: 'Settings',
    hidden: true, // Hidden from nav - managed via Sync page
  },
  access: {
    read: () => true,
    update: adminAccess,
  },
  fields: [
    {
      name: 'paJsonUrl',
      type: 'text',
      label: 'Pennsylvania JSON URL',
      admin: {
        description: 'Sixth City/Encompass8 QuickLink URL for PA distributors',
      },
    },
    {
      name: 'ohJsonUrl',
      type: 'text',
      label: 'Ohio JSON URL',
      admin: {
        description: 'Sixth City/Encompass8 QuickLink URL for OH distributors',
      },
    },
  ],
}
