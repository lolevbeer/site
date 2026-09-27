import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Site-wide button styles. Labels are sentence-case `text-sm font-semibold`
 * to match the header nav; hover only changes color.
 *
 * Pick the variant by role, not by look:
 * - `default` — the one primary action in a section (filled).
 * - `outline` — secondary actions, including every "View All …" link.
 * - `ghost` — icon-only controls (carousel arrows, social icons).
 * - `link` — a tertiary action that should read as text.
 *
 * Size sets the height; don't override it with `h-*` at the call site.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        outline: 'border border-border bg-transparent text-foreground hover:bg-secondary',
        ghost: 'text-foreground hover:bg-secondary',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2', // 40px height ✅ WCAG 2.2
        sm: 'h-9 px-3', // 36px height ✅ WCAG 2.2
        lg: 'h-11 px-8', // 44px height ✅ WCAG 2.2
        icon: 'h-10 w-10', // 40x40px ✅ WCAG 2.2 (24x24 minimum)
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
