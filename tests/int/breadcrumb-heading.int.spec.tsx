import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { BeerCard } from '@/components/beer/beer-card'
import { GlassType, type Beer } from '@/lib/types/beer'

vi.mock('next/navigation', () => ({ usePathname: () => '/beer/lupula' }))
vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: 'all' }),
}))
vi.mock('@/components/motion', () => ({
  MotionCard: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/beer/beer-image', () => ({ BeerImage: () => null }))
afterEach(cleanup)

it('renders direct list children with links and current-page semantics', () => {
  const { container } = render(<PageBreadcrumbs />)
  const list = container.querySelector('ol')!
  expect([...list.children].every((child) => child.tagName === 'LI')).toBe(true)
  expect(list.querySelector('a')?.getAttribute('href')).toBe('/')
  expect(list.querySelector('[aria-current="page"]')?.textContent).toBe('Lupula')
})

it.each(['full', 'minimal'] as const)(
  'renders %s catalog cards as h2 and nested cards as h3 without changing typography',
  (variant) => {
    const beer = {
      variant: 'lupula',
      name: 'Lupula',
      type: 'IPA',
      abv: 7,
      glass: GlassType.PINT,
      description: '',
      pricing: {},
      availability: {},
    } as Beer
    const { container, rerender } = render(
      <BeerCard beer={beer} variant={variant} headingLevel="h2" />,
    )
    const heading = container.querySelector('h2')!
    expect(heading.textContent).toBe('Lupula')
    const className = heading.className
    rerender(<BeerCard beer={beer} variant={variant} />)
    expect(container.querySelector('h3')?.className).toBe(className)
  },
)
