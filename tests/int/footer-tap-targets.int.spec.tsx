/**
 * Footer links are tall enough to tap on a phone: text links get vertical
 * padding and the social icons are 44 px (h-11) buttons.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Footer } from '@/components/layout/footer'
import { FooterTaprooms } from '@/components/layout/footer-taprooms'
import type { PayloadLocation } from '@/lib/types/location'

afterEach(cleanup)

describe('footer tap targets', () => {
  it('pads the text links and sizes the social icons at h-11', () => {
    render(<Footer taprooms={null} />)
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).className).toContain('py-2')
    expect(screen.getByRole('link', { name: 'Follow us on Instagram' }).className).toContain(
      'h-11',
    )
  })

  it('pads the taproom phone link', () => {
    const locations = [
      {
        id: 'l',
        slug: 'lawrenceville',
        name: 'Lawrenceville',
        basicInfo: { phone: '412-555-0100' },
      },
    ] as PayloadLocation[]
    render(<>{FooterTaprooms({ locations, weeklyHours: {} })}</>)
    expect(screen.getByRole('link', { name: '412-555-0100' }).className).toContain('py-2')
  })
})
