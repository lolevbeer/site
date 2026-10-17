import type { Access, Where } from 'payload'
import type { User } from '@/src/payload-types'
import {
  getUserLocationIds,
  hasRole,
  EVENT_MANAGER_ROLES,
  FOOD_MANAGER_ROLES,
} from '@/src/access/roles'

function locationScope(
  user: User | null | undefined,
  managers: Parameters<typeof hasRole>[1],
): Where | false | undefined {
  if (!hasRole(user, ['bartender', 'lead-bartender']) || hasRole(user, managers)) return undefined
  const ids = getUserLocationIds(user)
  return ids.length ? { location: { in: ids } } : false
}

export const readEvents: Access = ({ req: { user } }) => {
  const scope = locationScope(user, EVENT_MANAGER_ROLES)
  if (scope !== undefined) return scope
  return hasRole(user, EVENT_MANAGER_ROLES) ? true : { visibility: { equals: 'public' } }
}

export const readRecurringEvents: Access = (args) => {
  const result = readEvents(args)
  if (hasRole(args.req.user, ['admin', 'event-manager', 'bartender', 'lead-bartender']))
    return result
  return { active: { equals: true }, visibility: { equals: 'public' } }
}

export const readFood: Access = ({ req: { user } }) =>
  locationScope(user, FOOD_MANAGER_ROLES) ?? true

export const readRecurringFood: Access = ({ req: { user } }): boolean | Where => {
  const scope = locationScope(user, FOOD_MANAGER_ROLES)
  if (scope === false) return false
  if (hasRole(user, FOOD_MANAGER_ROLES)) return true
  return scope ? { and: [scope, { active: { equals: true } }] } : { active: { equals: true } }
}
