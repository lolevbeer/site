/**
 * Default admin dashboard per role, used by `admin.dashboard.defaultLayout` in
 * src/payload.config.ts. Office roles (admin, managers) get the full dashboard:
 * Needs attention, Recents & pinned, Inbox, menu targets and one schedule per
 * location. Bartenders and lead bartenders get only their assigned locations:
 * Needs attention (which switches between those locations itself), each of
 * their menus' items, and their schedules.
 *
 * Payload applies this only to people with no saved dashboard (or after a
 * reset), so changing it never rearranges anyone's existing layout. Callers
 * pass locations and menus already read as the signed-in user.
 */
import type { WidgetWidth } from 'payload'
import { getUserLocationIds, hasRole } from '@/src/access/roles'
import type { User } from '@/src/payload-types'
import { relationshipId } from '@/src/utils/relationship-id'

export type DashboardWidget = {
  widgetSlug: string
  width: WidgetWidth
  data?: Record<string, string>
}

type LayoutInput = {
  user: User | null | undefined
  locations: { id: string }[]
  menus: { id: string; location?: string | { id: string } | null }[]
}

export function defaultDashboardLayout({ user, locations, menus }: LayoutInput): DashboardWidget[] {
  const bartenderOnly =
    hasRole(user, ['bartender', 'lead-bartender']) &&
    !hasRole(user, ['admin', 'event-manager', 'beer-manager', 'food-manager'])

  if (!bartenderOnly) {
    return [
      { widgetSlug: 'needs-attention', width: 'medium' },
      { widgetSlug: 'activity', width: 'medium' },
      { widgetSlug: 'inbox', width: 'full' },
      { widgetSlug: 'menu-target-history', width: 'full' },
      ...locations.map((l): DashboardWidget => ({
        widgetSlug: 'schedule-heatmap',
        width: 'medium',
        data: { location: l.id },
      })),
    ]
  }

  const assigned = new Set(getUserLocationIds(user))
  return [
    { widgetSlug: 'needs-attention', width: 'full' },
    ...menus
      .filter((m) => m.location && assigned.has(relationshipId(m.location)))
      .map((m): DashboardWidget => ({
        widgetSlug: 'menu-items',
        width: 'medium',
        data: { menu: m.id },
      })),
    ...locations
      .filter((l) => assigned.has(l.id))
      .map((l): DashboardWidget => ({
        widgetSlug: 'schedule-heatmap',
        width: 'full',
        data: { location: l.id },
      })),
  ]
}
