import type { Access, FieldAccess } from 'payload'
import type { User } from '@/src/payload-types'

/**
 * Role types available in the system
 */
export type Role = 'admin' | 'event-manager' | 'beer-manager' | 'food-manager' | 'lead-bartender' | 'bartender'

/**
 * Check if a user has any of the specified roles
 *
 * Supports both:
 * - New `roles` array field (hasMany)
 * - Legacy `role` string field (for backwards compatibility during migration)
 *
 * @param user - The user object (may be null/undefined)
 * @param roles - Single role or array of roles to check
 * @returns true if user has at least one of the specified roles
 */
export function hasRole(user: User | null | undefined, roles: Role | Role[]): boolean {
  if (!user) return false

  const checkRoles = Array.isArray(roles) ? roles : [roles]

  // Check new `roles` array field
  if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
    return checkRoles.some((role) => user.roles.includes(role))
  }

  // Backwards compatibility: check legacy `role` string field
  if (user.role) {
    return checkRoles.includes(user.role as Role)
  }

  return false
}

/**
 * Check if user is an admin
 */
export function isAdmin(user: User | null | undefined): boolean {
  return hasRole(user, 'admin')
}

/**
 * Access control: User must be an admin
 */
export const adminAccess: Access = ({ req: { user } }) => {
  return isAdmin(user)
}

/**
 * Field access control: User must be an admin
 */
export const adminFieldAccess: FieldAccess = ({ req: { user } }) => {
  return isAdmin(user)
}

/**
 * Access control: User must be admin OR accessing their own record
 * Returns a Where clause so non-admins can see their own record in lists
 */
export const adminOrSelfAccess: Access = ({ req: { user } }) => {
  if (isAdmin(user)) return true

  // Non-admins can only see/access their own record
  if (user?.id) {
    return {
      id: {
        equals: user.id,
      },
    }
  }

  return false
}

/**
 * Access control: User must have admin or beer-manager role
 */
export const beerManagerAccess: Access = ({ req: { user } }) => {
  return hasRole(user, ['admin', 'beer-manager'])
}

/**
 * Access control: User must have admin or event-manager role
 */
export const eventManagerAccess: Access = ({ req: { user } }) => {
  return hasRole(user, ['admin', 'event-manager'])
}

/**
 * Access control: User must have admin or food-manager role
 */
export const foodManagerAccess: Access = ({ req: { user } }) => {
  return hasRole(user, ['admin', 'food-manager'])
}

/**
 * Access control: User must have admin or lead-bartender role
 * Used for creating bartender users
 */
export const leadBartenderAccess: Access = ({ req: { user } }) => {
  return hasRole(user, ['admin', 'lead-bartender'])
}
