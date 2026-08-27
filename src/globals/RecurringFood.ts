import type { GlobalConfig } from 'payload'
import { foodManagerAccess, hasRole } from '@/src/access/roles'

/**
 * RecurringFood Global
 *
 * Stores recurring food vendor schedules in a location-agnostic format.
 * Data is keyed by location ID (not hardcoded location names).
 *
 * Structure:
 * - schedules: { [locationId]: { [day]: { [week]: vendorId } } }
 *   Example: { "abc123": { "sunday": { "first": "vendor1", "second": null } } }
 *
 * - exclusions: { [locationId]: ['2024-01-15', ...] }
 *   Example: { "abc123": ["2024-01-15", "2024-02-20"] }
 */
export const RecurringFood: GlobalConfig = {
  slug: 'recurring-food',
  label: 'Recurring Food',
  admin: {
    group: 'Food & Events',
  },
  access: {
    read: ({ req: { user } }) => hasRole(user, ['admin', 'event-manager', 'food-manager']),
    update: foodManagerAccess,
  },
  fields: [
    {
      name: 'schedules',
      type: 'json',
      defaultValue: {},
      admin: {
        hidden: true,
        description: 'Recurring food schedules by location ID',
      },
    },
    {
      name: 'exclusions',
      type: 'json',
      defaultValue: {},
      admin: {
        hidden: true,
        description: 'Excluded dates by location ID',
      },
    },
    {
      name: 'normalizedAt',
      type: 'date',
      admin: {
        hidden: true,
        description: 'Set after legacy JSON data has been migrated to native collections.',
      },
    },
    {
      name: 'gridUI',
      type: 'ui',
      admin: {
        components: {
          Field: './components/RecurringFoodGrid#RecurringFoodGrid',
        },
      },
    },
  ],
}
