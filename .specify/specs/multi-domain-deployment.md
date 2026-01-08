# Feature Specification: Multi-Domain Deployment

**Feature Branch**: `payload`
**Created**: 2026-01-03
**Updated**: 2026-01-05
**Status**: Implemented
**Input**: Payload admin auth and CSRF configuration for multi-domain deployment (production, Vercel previews, localhost)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access Admin on Any Domain (Priority: P1)

As an admin, I want to access the Payload admin panel on any deployment domain (production, preview, localhost).

**Why this priority**: Essential for development workflow - admins need access across all environments.

**Independent Test**: Deploy to Vercel preview, navigate to /admin, verify login works and session persists.

**Acceptance Scenarios**:

1. **Given** an admin on production (lolev.beer), **When** they log in to /admin, **Then** session works correctly
2. **Given** an admin on Vercel preview URL, **When** they log in to /admin, **Then** session works correctly
3. **Given** an admin on localhost:3000, **When** they log in to /admin, **Then** session works correctly

---

### User Story 2 - Protected API Endpoints (Priority: P1)

As an admin, I want API endpoints to be protected with authentication so that unauthorized users cannot access sensitive operations.

**Why this priority**: Security - prevents unauthorized data modification.

**Independent Test**: Call /api/sync-google-sheets without auth, verify 401 response.

**Acceptance Scenarios**:

1. **Given** an unauthenticated request, **When** calling a protected endpoint, **Then** 401 Unauthorized is returned
2. **Given** an authenticated admin request, **When** calling a protected endpoint, **Then** request succeeds
3. **Given** an expired JWT token, **When** calling a protected endpoint, **Then** 401 is returned

---

### User Story 3 - CSRF Protection (Priority: P2)

The system should protect against cross-site request forgery while allowing legitimate multi-domain requests.

**Why this priority**: Security hardening - prevents malicious cross-origin attacks.

**Independent Test**: Verify CSRF token is required for state-changing operations from allowed origins only.

**Acceptance Scenarios**:

1. **Given** a request from lolev.beer, **When** making a POST request, **Then** CSRF validation passes
2. **Given** a request from unknown origin, **When** making a POST request, **Then** CSRF validation fails
3. **Given** a Vercel preview deployment, **When** making requests, **Then** CSRF validates against dynamic preview URL

---

### Edge Cases

- What happens when VERCEL_URL changes between deployments? Dynamic allowedOrigins array handles this
- What happens with www vs non-www domains? Both are in allowed origins list
- What happens when cookie is missing? getUserFromRequest fallback extracts JWT from headers

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST use relative URLs (empty serverURL) for multi-domain support
- **FR-002**: System MUST restrict CORS to explicit allowed origins list
- **FR-003**: System MUST enable CSRF protection for allowed origins
- **FR-004**: System MUST support JWT token extraction from cookies
- **FR-005**: System MUST include Vercel environment URLs in allowed origins dynamically
- **FR-006**: System MUST provide fallback authentication extraction for edge cases

### Key Entities

- **Allowed Origins**: Production domains, Vercel preview URLs, localhost
- **JWT Token**: Authentication token in `payload-token` cookie (7-day expiry)
- **CSRF Token**: Cross-site request forgery protection token

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin login works on all deployment domains
- **SC-002**: Protected endpoints return 401 for unauthenticated requests
- **SC-003**: CSRF protection blocks requests from unauthorized origins
- **SC-004**: Session persists across page navigation on all domains

## Implementation Summary

### Allowed Origins Configuration

```typescript
const allowedOrigins = [
  'https://lolev.beer',
  'https://www.lolev.beer',
  // Vercel preview deployments (dynamic)
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
  // Local development
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
]
```

### Payload Configuration

```typescript
export default buildConfig({
  serverURL: '',  // Empty = relative URLs, works on any domain
  cors: allowedOrigins,
  csrf: allowedOrigins,
  // ...
})
```

### Files Created/Modified

| File | Purpose |
|------|---------|
| `/src/payload.config.ts` | Multi-domain CORS/CSRF configuration |
| `/src/endpoints/auth-helper.ts` | JWT extraction utility |
| `/src/collections/Users.ts` | Auth configuration (7-day token expiry) |
| `/src/app/(frontend)/layout.tsx` | Frontend URL resolution |

### Authentication Flow

```
Request → Check req.user → If null, getUserFromRequest() →
  → Extract JWT from cookie → Decode payload →
  → Validate expiration → Lookup user by ID →
  → Return user or null
```

### Security Evolution

1. **Initial**: CSRF disabled for multi-domain support
2. **Hardened**: CSRF re-enabled with explicit allowed origins
3. **Current**: Full CSRF + CORS protection with dynamic Vercel URL support
