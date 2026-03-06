# Linear-Inspired Design Language Overhaul

## Goal

Elevate the entire Lolev Beer site to a premium, Linear-inspired feel across mobile, desktop, and TV displays. Core pillars: blur-to-sharp entrances, spring-based motion, atmospheric depth, and polished micro-interactions.

## Dependency

Add **Framer Motion** as the animation backbone. Replaces existing CSS animations with spring-based physics for page transitions, list staggering, hover states, and layout shifts.

---

## 1. Foundation: Motion & Atmosphere

### Blur-to-sharp entrance pattern
Every page and element fades in from a blurred, slightly scaled-up state. Individual elements (cards, text blocks, images) stagger in with `filter: blur(10px) -> blur(0)` + `opacity: 0 -> 1` + `scale(1.02) -> scale(1)`. This is the signature Linear feel.

### Atmospheric background
Subtle radial gradient that shifts based on page/section context (warm amber on beer pages, cooler on events). Faint noise texture overlay (2-3% opacity SVG tile) in dark mode for depth. Zero performance cost via CSS pseudo-element.

### Dark mode as the hero
Dark theme becomes the primary design target. Glowing accent colors (amber for beer elements) with subtle box-shadow halos. Light mode stays clean but dark mode gets the full treatment.

---

## 2. Micro-interactions & Component Polish

### Cards (beer, event, food)
- Hover: spring-based lift + soft glow border (amber tint in dark mode)
- Press: scale(0.98) for tactile feedback
- Image: blur-to-sharp on load with shimmer skeleton placeholder
- Filter/sort changes: layout animation so cards smoothly reposition

### Buttons
- Hover: background fills with spring transition, subtle glow in dark mode
- Press: scale(0.97) with spring physics
- "View Details" buttons: subtle arrow slides in from left on hover

### Badges ("Just Released", "Pouring", style badges)
- Entrance: pop in with spring overshoot
- Hover: slight brightness boost

### Images
- All images load with blur-to-sharp (CSS blur placeholder to sharp)
- Beer can/bottle images: subtle ambient shadow matching dominant color

### Navigation
- Active page indicator slides between nav items with spring animation
- Mobile menu: blur backdrop + slide-in with spring physics
- Location tabs: sliding underline indicator

### Scroll-triggered reveals
Replace current `ScrollReveal` with Framer Motion `whileInView`. Elements blur-in and translate up on viewport entry. Stagger children for natural cascade.

---

## 3. Page-Level Transitions & Layout

### Route transitions
Crossfade between routes: outgoing page fades + blurs out, incoming page fades + blurs in. Blur-in masks loading latency.

### Homepage hero
- Background: slow subtle parallax drift on scroll
- Beer carousel: staggered blur-in on first load
- CTAs: cascade in after hero text
- Gradient vignette deepens in dark mode

### Beer catalog (/beer)
- Sticky filter bar with glassmorphic backdrop-blur
- Filter changes: layout animation (smooth reflow, not pop)
- New cards blur in from below on load-more

### Beer detail pages
- Hero image: ambient color glow behind bottle/can
- Info sections stagger in on scroll
- Related beers: horizontal scroll with peek (partial cards at edges)

### Menu pages (/m/<slug>)
- TV: existing enter/exit upgraded to spring physics
- Smoother transitions on item rotation/cycling

### Footer
- Gradient separator instead of hard line
- Social icons: glow-on-hover

---

## 4. Typography & Visual Refinements

### Typography
- Tighter letter-spacing on large display text, looser on small labels
- Numeric values (ABV, ratings, prices): tabular figures, slightly heavier weight
- Hero headlines in dark mode: subtle text gradient (white to slightly warm white)

### Glassmorphism
- Sticky header: stronger backdrop-blur with semi-transparent background
- Extend glass treatment to "Just Released" badges and filter bars
- Toast notifications get glass treatment

### Color & light (dark mode)
- Primary interactive elements: subtle ambient glow (blurred box-shadow in accent color)
- Card hover: faint border gradient (accent color at ~10% opacity)
- Status badges ("On Tap", "Cans Available"): tiny pulsing dot indicator

### Noise texture
- Very subtle grain overlay (2-3% opacity) in dark mode background
- CSS pseudo-element with small tiling SVG, zero performance cost

---

## Out of Scope

- Command palette / keyboard shortcuts
- Structural page additions or new routes
- CMS schema changes
- Content changes
