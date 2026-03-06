# Linear-Inspired Design Language Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Elevate the entire Lolev Beer site to a premium, Linear-inspired feel with blur-to-sharp entrances, spring-based motion, atmospheric depth, and polished micro-interactions.

**Architecture:** Install Framer Motion as the animation backbone. Build a set of reusable motion primitives (BlurFade, MotionCard, PageTransition) that all pages and components compose from. Layer atmospheric CSS (noise texture, gradients, glows) into globals.css. Work bottom-up: primitives first, then components, then pages.

**Tech Stack:** Framer Motion 11+, Next.js 15 App Router, Tailwind CSS 4, React 19

---

### Task 1: Install Framer Motion

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run: `npm install framer-motion`

**Step 2: Verify installation**

Run: `npm ls framer-motion`
Expected: `framer-motion@11.x.x` listed

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add framer-motion dependency for animation system"
```

---

### Task 2: Create BlurFade motion primitive

The core building block. Wraps any element with blur-to-sharp + fade + scale entrance animation.

**Files:**
- Create: `components/motion/blur-fade.tsx`

**Step 1: Create the component**

```tsx
/**
 * BlurFade motion primitive.
 * Wraps children with a blur-to-sharp entrance animation using Framer Motion.
 * This is the core building block for the Linear-inspired design language.
 */

'use client';

import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  /** Starting blur amount in pixels */
  blur?: number;
  /** Whether to animate in from below */
  yOffset?: number;
  /** Trigger animation when element enters viewport */
  inView?: boolean;
  /** Fraction of element visible before triggering (0-1) */
  inViewMargin?: string;
}

const variants: Variants = {
  hidden: (custom: { blur: number; yOffset: number }) => ({
    opacity: 0,
    filter: `blur(${custom.blur}px)`,
    y: custom.yOffset,
    scale: 1.02,
  }),
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    scale: 1,
  },
};

export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.5,
  blur = 10,
  yOffset = 8,
  inView = false,
  inViewMargin = '-50px',
}: BlurFadeProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate={inView ? undefined : 'visible'}
      whileInView={inView ? 'visible' : undefined}
      viewport={inView ? { once: true, margin: inViewMargin } : undefined}
      custom={{ blur, yOffset }}
      variants={variants}
      transition={{
        delay,
        duration,
        ease: [0.25, 0.4, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/motion/blur-fade.tsx
git commit -m "Add BlurFade motion primitive for blur-to-sharp entrances"
```

---

### Task 3: Create MotionCard primitive

Reusable wrapper that adds spring hover/press interactions to any card.

**Files:**
- Create: `components/motion/motion-card.tsx`

**Step 1: Create the component**

```tsx
/**
 * MotionCard primitive.
 * Adds spring-based hover lift, press feedback, and optional glow border to any card element.
 */

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  /** Enable amber glow border on hover (dark mode only) */
  glow?: boolean;
}

const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 20,
};

export function MotionCard({
  children,
  className,
  glow = false,
}: MotionCardProps) {
  return (
    <motion.div
      className={cn(
        'will-change-transform',
        glow && 'dark:hover:shadow-[0_0_20px_rgba(255,149,0,0.08)] dark:hover:border-amber-500/10',
        className,
      )}
      whileHover={{ y: -4, transition: springTransition }}
      whileTap={{ scale: 0.98, transition: springTransition }}
    >
      {children}
    </motion.div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/motion/motion-card.tsx
git commit -m "Add MotionCard primitive for spring hover and press interactions"
```

---

### Task 4: Create StaggerChildren wrapper

Wraps a list of items and staggers their BlurFade entrance.

**Files:**
- Create: `components/motion/stagger-children.tsx`

**Step 1: Create the component**

```tsx
/**
 * StaggerChildren wrapper.
 * Staggers the entrance animation of child elements using Framer Motion layout groups.
 */

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StaggerChildrenProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between each child in seconds */
  staggerDelay?: number;
  /** Whether to trigger on viewport entry */
  inView?: boolean;
}

const containerVariants = {
  hidden: {},
  visible: (staggerDelay: number) => ({
    transition: {
      staggerChildren: staggerDelay,
    },
  }),
};

const itemVariants = {
  hidden: {
    opacity: 0,
    filter: 'blur(10px)',
    y: 8,
    scale: 1.02,
  },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.4, 0.25, 1],
    },
  },
};

export function StaggerChildren({
  children,
  className,
  staggerDelay = 0.06,
  inView = false,
}: StaggerChildrenProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate={inView ? undefined : 'visible'}
      whileInView={inView ? 'visible' : undefined}
      viewport={inView ? { once: true, margin: '-50px' } : undefined}
      custom={staggerDelay}
      variants={containerVariants}
    >
      {children}
    </motion.div>
  );
}

/** Wrap each child item with this to participate in stagger */
export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={cn(className)} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/motion/stagger-children.tsx
git commit -m "Add StaggerChildren wrapper for cascading entrance animations"
```

---

### Task 5: Create PageTransition wrapper

Wraps page content with a blur-in entrance. Used in each page's layout.

**Files:**
- Create: `components/motion/page-transition.tsx`

**Step 1: Create the component**

```tsx
/**
 * PageTransition wrapper.
 * Wraps page content with a blur-to-sharp entrance animation on route changes.
 */

'use client';

import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(8px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/motion/page-transition.tsx
git commit -m "Add PageTransition wrapper for route-level blur-in animation"
```

---

### Task 6: Create motion barrel export

**Files:**
- Create: `components/motion/index.ts`

**Step 1: Create barrel export**

```ts
/** Motion primitives for Linear-inspired animations */
export { BlurFade } from './blur-fade';
export { MotionCard } from './motion-card';
export { StaggerChildren, StaggerItem } from './stagger-children';
export { PageTransition } from './page-transition';
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/motion/index.ts
git commit -m "Add barrel export for motion primitives"
```

---

### Task 7: Add atmospheric CSS — noise texture, gradient backgrounds, glows

**Files:**
- Modify: `src/app/(frontend)/globals.css`

**Step 1: Add noise texture and atmospheric styles**

Add the following at the end of the `@layer base` section (after the existing body styles, before the `@layer components` section). Find the exact insertion point by locating the closing `}` of the `@layer base` block.

```css
/* Noise texture overlay for dark mode depth */
.dark body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
}
```

**Step 2: Add glow utility classes**

Add to the `@layer utilities` section (or create one if it doesn't exist):

```css
@layer utilities {
  /* Ambient glow for interactive elements in dark mode */
  .glow-amber {
    @apply dark:shadow-[0_0_20px_rgba(255,149,0,0.12)];
  }

  .glow-accent {
    @apply dark:shadow-[0_0_20px_rgba(10,132,255,0.12)];
  }

  /* Glassmorphic backdrop */
  .glass {
    @apply bg-background/80 backdrop-blur-xl border border-border/50;
  }

  /* Gradient separator */
  .gradient-separator {
    @apply h-px bg-gradient-to-r from-transparent via-border to-transparent;
  }
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/(frontend)/globals.css
git commit -m "Add atmospheric CSS: noise texture, glow utilities, glassmorphism"
```

---

### Task 8: Upgrade header to glassmorphic sticky bar

**Files:**
- Modify: `components/layout/header.tsx`

**Step 1: Update header background styling**

Find the header element (around line 43). Replace the current background/border classes with glassmorphic styling:

Current (approximately):
```tsx
className={`sticky top-0 z-50 ...`}
```

Update the header's className to include:
- Replace any `bg-background` or `bg-card` with `bg-background/80 backdrop-blur-xl`
- Add `border-b border-border/50` if not already present
- Keep `sticky top-0 z-50` and transition classes

The exact diff depends on current classes, but the goal is:
```
bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50
```

**Step 2: Verify visually**

Run: `npm run dev` and check header has frosted glass effect on scroll.

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add components/layout/header.tsx
git commit -m "Upgrade header to glassmorphic sticky bar with backdrop blur"
```

---

### Task 9: Upgrade footer with gradient separator and glow social icons

**Files:**
- Modify: `components/layout/footer.tsx`
- Modify: `components/layout/social-links.tsx`

**Step 1: Replace the footer's top border with a gradient separator**

In `footer.tsx`, find the top-level footer element's `border-t` class. Replace it with a child `<div className="gradient-separator" />` at the top of the footer content (uses the utility from Task 7).

**Step 2: Add glow hover to social icons**

In `social-links.tsx`, find where each social link icon is rendered. Add to each link's className:
```
dark:hover:shadow-[0_0_12px_rgba(255,255,255,0.15)] transition-shadow
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add components/layout/footer.tsx components/layout/social-links.tsx
git commit -m "Add gradient separator to footer and glow hover to social icons"
```

---

### Task 10: Replace ScrollReveal with BlurFade

The existing `ScrollReveal` uses IntersectionObserver + CSS. Replace with the `BlurFade` primitive for consistency.

**Files:**
- Modify: `components/ui/scroll-reveal.tsx` (rewrite to use BlurFade)

**Step 1: Rewrite ScrollReveal as a thin wrapper around BlurFade**

```tsx
/**
 * ScrollReveal component.
 * Thin wrapper around BlurFade that triggers on viewport entry.
 * Drop-in replacement for the previous IntersectionObserver-based implementation.
 */

'use client';

import { BlurFade } from '@/components/motion';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  return (
    <BlurFade className={className} delay={delay} inView>
      {children}
    </BlurFade>
  );
}
```

This preserves the same API so all existing consumers work without changes.

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Verify visually**

Run: `npm run dev`, scroll down on homepage — sections should blur-in on viewport entry.

**Step 4: Commit**

```bash
git add components/ui/scroll-reveal.tsx
git commit -m "Replace ScrollReveal with BlurFade-based implementation"
```

---

### Task 11: Add blur-to-sharp image loading to BeerImage

**Files:**
- Modify: `components/beer/beer-image.tsx`

**Step 1: Add blur-to-sharp loading state**

Wrap the Next.js `Image` component. When the image loads, transition from `blur(12px) scale(1.02)` to `blur(0) scale(1)` using CSS transitions (not Framer Motion — these are frequent renders in lists).

Add a loading state and update the image wrapper:

- Add `const [loaded, setLoaded] = useState(false)` state
- On the `Image` component, add `onLoad={() => setLoaded(true)}`
- On the image wrapper div, add conditional CSS:
  ```
  style={{
    filter: loaded ? 'blur(0px)' : 'blur(12px)',
    transform: loaded ? 'scale(1)' : 'scale(1.02)',
    transition: 'filter 0.5s ease-out, transform 0.5s ease-out',
  }}
  ```

Keep the existing error/fallback behavior unchanged.

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/beer/beer-image.tsx
git commit -m "Add blur-to-sharp loading transition to BeerImage"
```

---

### Task 12: Upgrade BeerCard minimal variant with MotionCard

**Files:**
- Modify: `components/beer/beer-card.tsx`

**Step 1: Import and wrap**

Import `MotionCard` from `@/components/motion`. In the minimal variant (the `if (variant === 'minimal')` block), wrap the outer `<Link>` content with `<MotionCard glow>`. Remove the existing CSS hover classes that MotionCard now handles:
- Remove `hover:-translate-y-1` from the Link
- Remove `group-hover:scale-[1.02]` from the image container (MotionCard handles the lift)

Keep the `group` class on the Link for other group-hover effects (like button background).

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/beer/beer-card.tsx
git commit -m "Upgrade BeerCard minimal variant with MotionCard spring interactions"
```

---

### Task 13: Upgrade BeerCard full variant with MotionCard

**Files:**
- Modify: `components/beer/beer-card.tsx`

**Step 1: Update BaseCard wrapper**

The full variant uses `BaseCard`. Either:
- Wrap the `BaseCard` with `<MotionCard glow>` and remove the hover translate classes from BaseCard's styling for this instance via className override, OR
- Add `className` to the BaseCard call that includes MotionCard's glow classes and let BaseCard's existing hover work alongside

Simplest: wrap the entire `<BaseCard>` return with `<MotionCard glow>` and pass `className` to BaseCard to disable its own translate (pass `hover:translate-y-0` to neutralize).

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/beer/beer-card.tsx
git commit -m "Upgrade BeerCard full variant with MotionCard spring interactions"
```

---

### Task 14: Add PageTransition to homepage

**Files:**
- Modify: `src/app/(frontend)/page.tsx` (or the homepage server component that renders the main content)

**Step 1: Wrap homepage content with PageTransition**

Import `PageTransition` from `@/components/motion`. Wrap the main content of the homepage with `<PageTransition>`. Since this is a server component, you may need to either:
- Create a client wrapper component, or
- Wrap the client components that are already there

Check if the homepage already has a client component boundary. If the hero section and featured menus are already client components, wrap them individually or add PageTransition in a client layout wrapper.

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(frontend)/page.tsx
git commit -m "Add blur-in page transition to homepage"
```

---

### Task 15: Add PageTransition to beer catalog

**Files:**
- Modify: `components/beer/beer-page-content.tsx`

**Step 1: Wrap beer page content**

`BeerPageContent` is already a client component. Import `PageTransition` from `@/components/motion` and wrap the outermost div with `<PageTransition>`.

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/beer/beer-page-content.tsx
git commit -m "Add blur-in page transition to beer catalog"
```

---

### Task 16: Add PageTransition to remaining pages

**Files:**
- Modify: `src/app/(frontend)/beer/[variant]/page.tsx` (beer detail)
- Modify: `src/app/(frontend)/events/page.tsx`
- Modify: `src/app/(frontend)/food/page.tsx`
- Modify: `src/app/(frontend)/about/page.tsx`
- Modify: `src/app/(frontend)/faq/page.tsx`

**Step 1: Add PageTransition to each page**

For each page, wrap the main content with `<PageTransition>`. For server components, wrap the first client component boundary or create a thin client wrapper.

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(frontend)/beer/[variant]/page.tsx src/app/(frontend)/events/page.tsx src/app/(frontend)/food/page.tsx src/app/(frontend)/about/page.tsx src/app/(frontend)/faq/page.tsx
git commit -m "Add blur-in page transition to all remaining pages"
```

---

### Task 17: Upgrade hero section with staggered blur-in

**Files:**
- Modify: `components/home/hero-section.tsx`

**Step 1: Replace CSS stagger animations with BlurFade**

Import `BlurFade` from `@/components/motion`. Replace the current `animate-stagger-in opacity-0` classes and `animationDelay` inline styles with `<BlurFade delay={...}>` wrappers:

- Hero title: `<BlurFade delay={0}>`
- Subtitle/tagline: `<BlurFade delay={0.1}>`
- Beer carousel: `<BlurFade delay={0.2}>`
- CTA buttons: `<BlurFade delay={0.3}>`

Remove the `animate-stagger-in` and `opacity-0` classes from these elements.

**Step 2: Add subtle text gradient to hero headline in dark mode**

Add to the hero h1 className:
```
dark:bg-gradient-to-b dark:from-white dark:to-white/70 dark:bg-clip-text dark:text-transparent
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add components/home/hero-section.tsx
git commit -m "Upgrade hero with staggered blur-in and dark mode text gradient"
```

---

### Task 18: Upgrade beer catalog with StaggerChildren for card grid

**Files:**
- Modify: `components/beer/beer-page-content.tsx`

**Step 1: Add glassmorphic filter bar**

Find the sticky filter/sort controls section. Add `glass` class (from Task 7) to the sticky container:
```
className="sticky top-14 z-40 glass rounded-lg ..."
```

**Step 2: Wrap beer grid with StaggerChildren**

Import `StaggerChildren` and `StaggerItem` from `@/components/motion`. Wrap the beer grid container with `<StaggerChildren inView>` and each `<BeerCard>` with `<StaggerItem>`.

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add components/beer/beer-page-content.tsx
git commit -m "Add glassmorphic filter bar and staggered card entrance to beer catalog"
```

---

### Task 19: Add animated nav indicator to header

**Files:**
- Modify: `components/layout/header.tsx` (or the nav links component within it)

**Step 1: Add sliding active indicator**

Import `motion` from `framer-motion`. For the desktop nav links, add a `layoutId="nav-indicator"` animated underline to the active link:

```tsx
{isActive && (
  <motion.div
    layoutId="nav-indicator"
    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
  />
)}
```

Each nav link needs `relative` positioning. The `layoutId` shared across all nav items causes Framer Motion to animate the indicator between them.

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/layout/header.tsx
git commit -m "Add spring-animated nav indicator to header"
```

---

### Task 20: Upgrade mobile menu with blur backdrop and spring animation

**Files:**
- Modify: `components/layout/mobile-menu.tsx` (or wherever the mobile menu sheet lives)

**Step 1: Add backdrop blur**

Find the mobile menu overlay/backdrop. Add `backdrop-blur-xl` to the overlay.

**Step 2: Add spring-based slide-in**

If using Radix Sheet, the animation is CSS-based. Add Framer Motion `AnimatePresence` + `motion.div` for the menu panel:

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ x: '100%', filter: 'blur(4px)' }}
      animate={{ x: 0, filter: 'blur(0px)' }}
      exit={{ x: '100%', filter: 'blur(4px)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* menu content */}
    </motion.div>
  )}
</AnimatePresence>
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add components/layout/mobile-menu.tsx
git commit -m "Upgrade mobile menu with blur backdrop and spring slide-in"
```

---

### Task 21: Add pulsing status dots to badges

**Files:**
- Modify: `components/ui/status-badge.tsx`

**Step 1: Add pulsing dot indicator**

For status badges like "On Tap" and "Cans Available", add a tiny animated dot:

```tsx
<span className="relative flex h-2 w-2 mr-1">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
  <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
</span>
```

Tailwind's built-in `animate-ping` handles the pulse. Add this before the badge text for "live" status badges (on_tap, cans).

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/ui/status-badge.tsx
git commit -m "Add pulsing status dots to live availability badges"
```

---

### Task 22: Add button hover arrow animation

**Files:**
- Modify: `components/ui/button.tsx`

**Step 1: Add a new `withArrow` variant or extend the outline variant**

For "View Details" style buttons, add a CSS-only sliding arrow on hover. Add a utility class or variant:

```css
/* In globals.css utilities layer */
.btn-arrow::after {
  content: '\2192';
  display: inline-block;
  margin-left: 0;
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.2s ease;
}

.btn-arrow:hover::after {
  margin-left: 0.5rem;
  opacity: 1;
  transform: translateX(0);
}
```

Apply the `btn-arrow` class to "View Details" buttons in beer-card.tsx and featured-menu.tsx.

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(frontend)/globals.css components/ui/button.tsx
git commit -m "Add sliding arrow hover animation to action buttons"
```

---

### Task 23: Add location tab sliding indicator

**Files:**
- Modify: the component that renders location tabs (likely in `components/layout/header.tsx` or a dedicated location-tabs component)

**Step 1: Add layoutId-based sliding indicator**

Same pattern as Task 19 but for the location tab switcher:

```tsx
{isSelected && (
  <motion.div
    layoutId="location-indicator"
    className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
  />
)}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/layout/header.tsx
git commit -m "Add spring-animated location tab indicator"
```

---

### Task 24: Upgrade toast notifications with glass styling

**Files:**
- Modify: `components/ui/sonner.tsx`

**Step 1: Add glassmorphic styling to Sonner toasts**

In the Sonner component configuration, add className overrides for the toast container:

```tsx
toastOptions={{
  classNames: {
    toast: 'glass !bg-background/80 !backdrop-blur-xl !border-border/50',
  },
}}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/ui/sonner.tsx
git commit -m "Add glassmorphic styling to toast notifications"
```

---

### Task 25: Typography refinements

**Files:**
- Modify: `src/app/(frontend)/globals.css`

**Step 1: Add typography utility classes**

In the utilities layer:

```css
/* Tabular figures for numeric values */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Tighter tracking for display text */
.tracking-display {
  letter-spacing: -0.03em;
}

/* Slightly looser for labels */
.tracking-label {
  letter-spacing: 0.02em;
}
```

**Step 2: Apply to key elements**

- Hero headline: add `tracking-display`
- ABV values, prices, ratings: ensure `tabular-nums` (Tailwind has this built-in, verify it's applied)
- Small badge labels: add `tracking-label` where appropriate

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(frontend)/globals.css
git commit -m "Add typography refinements: tabular nums, tracking utilities"
```

---

### Task 26: Final visual QA pass

**Files:**
- All modified files

**Step 1: Full build verification**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Visual QA checklist**

Run `npm run dev` and verify each of the following:

- [ ] Homepage hero blurs in on load
- [ ] Beer cards lift with spring physics on hover
- [ ] Dark mode has noise texture (very subtle grain)
- [ ] Header has frosted glass effect
- [ ] Footer has gradient separator
- [ ] Beer images blur-to-sharp on load
- [ ] Scroll reveals use blur-in (not just fade)
- [ ] Beer catalog filter bar is glassmorphic
- [ ] Nav indicator slides between links
- [ ] Mobile menu slides in with spring + blur backdrop
- [ ] Status badges have pulsing dots
- [ ] Toast notifications have glass styling
- [ ] No layout shift or jank on any page
- [ ] TV menu pages still work correctly (no Framer Motion interference)

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "Visual QA fixes for Linear design language overhaul"
```

---

## Dependencies Between Tasks

- **Tasks 1**: Must be first (installs Framer Motion)
- **Tasks 2-6**: Motion primitives, can be done in parallel after Task 1
- **Task 7**: CSS foundation, independent of Tasks 2-6
- **Tasks 8-9**: Can run after Task 7 (use CSS utilities)
- **Task 10**: Depends on Task 2 (uses BlurFade)
- **Task 11**: Independent (CSS-only)
- **Tasks 12-13**: Depend on Task 3 (use MotionCard)
- **Tasks 14-16**: Depend on Task 5 (use PageTransition)
- **Task 17**: Depends on Task 2 (uses BlurFade)
- **Task 18**: Depends on Tasks 4, 7 (StaggerChildren + glass CSS)
- **Tasks 19-20**: Depend on Task 1 (use framer-motion directly)
- **Tasks 21-25**: Independent, CSS-focused
- **Task 26**: Must be last
