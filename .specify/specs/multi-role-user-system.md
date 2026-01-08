# Feature Specification: Multi-Role User System

**Feature Branch**: `payload`
**Created**: 2026-01-02
**Updated**: 2026-01-05
**Status**: Implemented
**Input**: Role-based access control with multiple roles per user and location-based restrictions

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assign Multiple Roles to User (Priority: P1)

As an admin, I want to assign multiple roles to a user so they can manage different areas of the business.

**Why this priority**: Flexibility - staff often have multiple responsibilities.

**Independent Test**: Create user with [beer-manager, event-manager] roles, verify they can edit both beers and events.

**Acceptance Scenarios**:

1. **Given** an admin creating a user, **When** they select multiple roles, **Then** user has permissions from all selected roles
2. **Given** a user with beer-manager role, **When** they access Beers collection, **Then** they can create/edit beers
3. **Given** a user with event-manager role, **When** they access Events collection, **Then** they can create/edit/delete events

---

### User Story 2 - Restrict Bartender by Location (Priority: P2)

As an admin, I want to restrict bartenders to specific locations so they can only edit menus for their taproom.

**Why this priority**: Security - prevents accidental changes to other locations' menus.

**Independent Test**: Create bartender with Lawrenceville location, verify they can only see/edit Lawrenceville menus.

**Acceptance Scenarios**:

1. **Given** a bartender assigned to Lawrenceville, **When** they view Menus, **Then** only Lawrenceville menus appear
2. **Given** a bartender with no location restriction, **When** they view Menus, **Then** all menus appear
3. **Given** a bartender editing a menu, **When** they save, **Then** changes only affect their assigned location

---

### User Story 3 - Admin Full Access (Priority: P1)

As an admin, I want full access to all collections and settings regardless of other roles.

**Why this priority**: Administration - admins need unrestricted access for management.

**Independent Test**: Login as admin, verify access to all collections including Users and system settings.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they access any collection, **Then** full CRUD access is granted
2. **Given** an admin user, **When** they access Users collection, **Then** they can create/edit/delete users
3. **Given** an admin user, **When** they access system globals, **Then** they can edit all settings

---

### Edge Cases

- What happens when user has no roles? Default role is "bartender"
- What happens with legacy single-role users? hasRole() checks both `roles` array and legacy `role` field
- What happens when assigned location is deleted? User sees no menus (empty location filter)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support five roles: admin, event-manager, beer-manager, food-manager, bartender
- **FR-002**: System MUST allow multiple roles per user via `roles` array field
- **FR-003**: System MUST maintain backwards compatibility with legacy `role` string field
- **FR-004**: System MUST restrict bartenders to assigned locations for menu access
- **FR-005**: System MUST provide role-checking utilities: `hasRole()`, `isAdmin()`
- **FR-006**: System MUST provide collection-level access: `adminAccess`, `beerManagerAccess`, etc.

### Key Entities

- **User.roles**: Array of role strings (required, default: ['bartender'])
- **User.role**: Legacy single role field (hidden, for backwards compatibility)
- **User.locations**: Relationship to Locations (for bartender restrictions)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users with multiple roles have combined permissions
- **SC-002**: Legacy single-role users continue to work correctly
- **SC-003**: Location-restricted bartenders see only assigned menus
- **SC-004**: Role changes take effect immediately without re-login

## Implementation Summary

### Role Hierarchy

| Role | Beers | Events | Food | Menus | Products | Users | Settings |
|------|-------|--------|------|-------|----------|-------|----------|
| Admin | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD |
| Event Manager | R | CRUD | R | R | R | - | R |
| Beer Manager | CRUD | R | R | R | CRUD | - | R |
| Food Manager | R | R | CRUD | R | R | - | R |
| Bartender | R | R | R | RU* | R | R (self) | R |

*RU = Read + Update (with location filtering)

### Access Control Functions

```typescript
// Check if user has any of the specified roles
function hasRole(user: User, roles: string | string[]): boolean

// Check if user is admin
function isAdmin(user: User): boolean

// Collection access controls
const adminAccess: Access
const adminOrSelfAccess: Access
const beerManagerAccess: Access
const eventManagerAccess: Access
const foodManagerAccess: Access
```

### Files Created/Modified

| File | Purpose |
|------|---------|
| `/src/access/roles.ts` | Core role-checking logic and access functions |
| `/src/collections/Users.ts` | User schema with roles array and locations |
| `/src/collections/Beers.ts` | Beer manager access control |
| `/src/collections/Events.ts` | Event manager access control |
| `/src/collections/Food.ts` | Food manager access control |
| `/src/collections/Menus.ts` | Location-based bartender access |
| `/src/collections/Products.ts` | Beer manager access control |

### Backwards Compatibility

```typescript
function hasRole(user: User, roles: string | string[]): boolean {
  const roleArray = Array.isArray(roles) ? roles : [roles]

  // Check new roles array first
  if (user.roles?.some(r => roleArray.includes(r))) return true

  // Fall back to legacy role field
  if (user.role && roleArray.includes(user.role)) return true

  return false
}
```

### Location-Based Access (Menus)

```typescript
const canReadMenus: Access = ({ req: { user } }) => {
  if (!user) return { _status: { equals: 'published' } }
  if (isAdmin(user)) return true

  const locationIds = getUserLocationIds(user)
  if (locationIds.length === 0) return true // No restriction

  return { location: { in: locationIds } }
}
```
