/**
 * /food answers "what can I eat there today?" first (#338): a Today card for
 * the selected taproom (the truck, or the outside-food policy when none is
 * booked), then the coming week, with later dates behind a button.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FoodPageClient } from '@/src/app/(frontend)/food/food-page-client'
import { OUTSIDE_FOOD_POLICY } from '@/lib/utils/faq-schema'
import type { FoodPageSchedule } from '@/lib/utils/public-client-payloads'

vi.mock('@/components/ui/page-breadcrumbs', () => ({ PageBreadcrumbs: () => null }))
vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    currentLocation: 'lawrenceville',
    cycleLocation: vi.fn(),
    locations: [
      { id: '1', slug: 'lawrenceville', name: 'Lawrenceville' },
      { id: '2', slug: 'zelienople', name: 'Zelienople' },
    ],
  }),
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-13T17:00:00Z')) // Fri Nov 13, noon ET
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const truck = (vendor: string, date: string): FoodPageSchedule => ({
  vendor,
  date,
  time: '17:00',
  location: 'lawrenceville',
})

it("puts today's truck in a Today card and keeps it out of the list", () => {
  render(
    <FoodPageClient
      initialSchedules={[truck('Pierogi Truck', '2026-11-13'), truck('Taco Truck', '2026-11-14')]}
    />,
  )
  const card = screen.getByRole('heading', { name: 'Today at Lawrenceville' }).closest('section')!
  expect(card.textContent).toContain('Pierogi Truck')
  expect(screen.getAllByText('Pierogi Truck')).toHaveLength(1)
  expect(screen.getByText('Taco Truck')).toBeTruthy()
})

it('says so when no truck is booked today, with the outside-food policy', () => {
  render(<FoodPageClient initialSchedules={[truck('Taco Truck', '2026-11-14')]} />)
  const card = screen.getByRole('heading', { name: 'Today at Lawrenceville' }).closest('section')!
  expect(card.textContent).toContain('No food truck today')
  expect(card.textContent).toContain(OUTSIDE_FOOD_POLICY)
})

it('shows the coming week and puts later dates behind a button', () => {
  render(
    <FoodPageClient
      initialSchedules={[truck('Taco Truck', '2026-11-19'), truck('Later Truck', '2026-11-20')]}
    />,
  )
  expect(screen.getByText('Taco Truck')).toBeTruthy()
  expect(screen.queryByText('Later Truck')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show later dates' }))
  expect(screen.getByText('Later Truck')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Show later dates' })).toBeNull()
})

it('keeps the nothing-booked state distinct from an empty today', () => {
  render(<FoodPageClient initialSchedules={[]} />)
  expect(screen.queryByRole('heading', { name: 'Today at Lawrenceville' })).toBeNull()
  expect(screen.getByText('No Food Trucks Scheduled')).toBeTruthy()
  expect(document.body.textContent).toContain(OUTSIDE_FOOD_POLICY)
})
