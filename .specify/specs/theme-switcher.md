# Feature Specification: Theme Switcher with EST Auto-Switching

**Feature Branch**: `payload`
**Created**: 2026-01-04
**Updated**: 2026-01-05
**Status**: Implemented
**Input**: Vercel-style theme switcher with automatic dark/light mode based on Pittsburgh sunrise/sunset

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Theme Based on Time (Priority: P1)

A visitor wants the site to automatically switch to dark mode in the evening and light mode during the day.

**Why this priority**: User experience - reduces eye strain and matches ambient lighting.

**Independent Test**: Set system to "system" mode, verify theme changes at sunrise/sunset times.

**Acceptance Scenarios**:

1. **Given** a visitor with "system" theme selected, **When** current time is after sunset, **Then** dark theme is applied
2. **Given** a visitor with "system" theme selected, **When** current time is before sunset, **Then** light theme is applied
3. **Given** a visitor in a different timezone, **When** viewing the site, **Then** theme switches based on Pittsburgh EST/EDT time

---

### User Story 2 - Manual Theme Selection (Priority: P1)

A visitor wants to manually choose light or dark mode regardless of time of day.

**Why this priority**: Accessibility - users should control their experience.

**Independent Test**: Click light mode in footer, verify theme is light. Click dark mode, verify theme is dark.

**Acceptance Scenarios**:

1. **Given** a visitor on any page, **When** they click "Light" in theme switcher, **Then** light theme is applied immediately
2. **Given** a visitor on any page, **When** they click "Dark" in theme switcher, **Then** dark theme is applied immediately
3. **Given** a visitor with manual theme selected, **When** they reload the page, **Then** theme preference persists

---

### User Story 3 - Theme Persistence (Priority: P2)

A visitor wants their theme preference to be remembered across visits.

**Why this priority**: Convenience - avoids re-selecting preference each visit.

**Independent Test**: Select dark mode, close browser, reopen site, verify dark mode is still active.

**Acceptance Scenarios**:

1. **Given** a visitor who selected dark mode, **When** they return to the site, **Then** dark mode is pre-selected
2. **Given** a visitor who selected "system" mode, **When** they return to the site, **Then** automatic switching is active

---

### Edge Cases

- What happens at exact sunrise/sunset moment? Theme switches within 1 minute via fallback interval
- What happens if localStorage is unavailable? Defaults to "system" mode
- What happens during DST transition? EDT/EST handled automatically by JavaScript timezone API

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide three theme modes: system, light, dark
- **FR-002**: System MUST auto-switch theme based on Pittsburgh sunrise/sunset when in "system" mode
- **FR-003**: System MUST persist theme preference in localStorage with key `lolev-theme`
- **FR-004**: System MUST calculate sunrise/sunset using sine wave approximation for Pittsburgh (40.4N)
- **FR-005**: System MUST check for theme transitions every 60 seconds as fallback
- **FR-006**: System MUST apply theme by toggling `dark` class on `<html>` element

### Key Entities

- **Theme Mode**: "system" | "light" | "dark"
- **Sunrise/Sunset**: Calculated times in EST/EDT for Pittsburgh
- **Theme Provider**: Next-themes wrapper with localStorage persistence

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Theme auto-switches within 1 minute of actual sunrise/sunset
- **SC-002**: Manual theme selection applies instantly (no flash)
- **SC-003**: Theme preference persists across browser sessions
- **SC-004**: No hydration mismatch errors during SSR

## Implementation Summary

### Sunrise/Sunset Calculation

```typescript
// Pittsburgh (40.4N latitude) approximation
const dayOfYear = getDayOfYear(date)
const angle = (2 * Math.PI * (dayOfYear - 172)) / 365 // Peak at summer solstice

// Sunset: 5 PM winter to 9 PM summer
const sunsetHour = 19 - 2 * Math.cos(angle)

// Sunrise: 7:40 AM winter to 5:50 AM summer
const sunriseHour = 6.75 + 0.92 * Math.cos(angle)
```

### Files Created/Modified

| File | Purpose |
|------|---------|
| `/components/providers/auto-theme-switcher.tsx` | EST-based auto-switching logic |
| `/components/ui/theme-switcher.tsx` | Three-button theme selector UI |
| `/components/ui/theme-toggle.tsx` | Simple light/dark toggle |
| `/components/providers/theme-provider.tsx` | Next-themes wrapper |
| `/src/app/(frontend)/layout.tsx` | Theme provider initialization |
| `/components/layout/footer.tsx` | Theme switcher placement |

### Theme Provider Configuration

```typescript
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
  themes={['light', 'dark']}
  storageKey="lolev-theme"
/>
```

### Update Strategy

1. **Primary**: Scheduled timeout at next sunrise/sunset transition
2. **Secondary**: 60-second interval as fallback for edge cases
