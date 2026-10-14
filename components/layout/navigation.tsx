'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** A site navigation entry. */
interface NavItem {
  label: string
  href: string
}

const navigationItems: NavItem[] = [
  { label: 'Find Our Beer', href: '/beer-map' },
  { label: 'Beer', href: '/beer' },
  { label: 'Food', href: '/food' },
  { label: 'Events', href: '/events' },
  { label: 'About', href: '/about' },
  { label: 'FAQ', href: '/faq' },
]

/** True on the item's page and on pages nested under it (`/beer/aardwolf` → Beer). */
export function isNavItemActive(pathname: string | null, href: string): boolean {
  return pathname === href || !!pathname?.startsWith(`${href}/`)
}

/**
 * Desktop header navigation. The mobile menu renders its own list from
 * `navigationItems` (see mobile-menu.tsx).
 */
export function Navigation() {
  const pathname = usePathname()

  return (
    <nav
      className="flex items-center space-x-2 lg:space-x-4 xl:space-x-6"
      aria-label="Main navigation"
    >
      {navigationItems.map((item) => {
        const isActive = isNavItemActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              // py-1, not pb-1: the bottom gap clears the active underline, and the
              // matching top padding keeps the label on the header's centerline.
              'relative py-1 transition-all duration-200 ease-in-out whitespace-nowrap text-sm font-semibold',
              isActive ? 'text-foreground' : 'text-foreground hover:text-muted-foreground',
            )}
          >
            {item.label}
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Footer-only links. Donations and Jobs stay out of the header and mobile menu.
 */
const footerOnlyItems: NavItem[] = [
  { label: 'Donations', href: '/donate' },
  { label: 'Jobs', href: '/jobs' },
]

export { navigationItems, footerOnlyItems }
