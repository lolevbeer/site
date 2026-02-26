# Hero Section Redesign

## Problem
The current hero has an aggressive white gradient wash that kills the taproom photo, tiny floating beer cans with no visual grounding, too much stacked text, three inconsistent button styles, and a pulsing glow effect on the primary CTA.

## Design Decisions
- **Theme-adaptive overlay**: Light mode uses a white gradient (heavier at bottom), dark mode uses a black gradient. No backdrop-blur.
- **Bigger cans with shadows**: Increase can images from 64/96px to 96/144px with `drop-shadow-lg` for depth.
- **Tagline + one paragraph**: Split `heroDescription` on `\n\n`. First paragraph renders bold/large as tagline, second as smaller supporting text. Extra paragraphs ignored.
- **Two buttons**: "Find Lolev" (primary) + "Our Story" (outline). Newsletter removed from hero (will move to footer + quick info cards in a follow-up).
- **No glow pulse**: Remove `animate-glow-pulse` from the primary button.

## Scope
Single file change: `components/home/hero-section.tsx`

### Not changing
- Component props or CMS integration (heroDescription, heroImageUrl)
- Carousel library (Embla via shadcn)
- Tooltips, stagger-in animations
- Homepage layout or other components
- Newsletter destination (follow-up: inline email capture + placement in footer/quick info)

## Implementation Steps

1. Replace overlay gradient with theme-adaptive variants (light/dark)
2. Remove `backdrop-blur-[2px]`
3. Increase can image dimensions and add `drop-shadow-lg`
4. Split heroDescription into tagline + support paragraph
5. Remove Newsletter button, keep Find Lolev (primary) + Our Story (outline)
6. Remove `animate-glow-pulse` from primary button
7. Run `tsc --noEmit` to verify
