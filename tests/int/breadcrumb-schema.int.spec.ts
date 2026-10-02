/**
 * Breadcrumb and WebPage JSON-LD contract. The route breadcrumb renderer
 * (PageBreadcrumbs) is the single source of BreadcrumbList on a page and is
 * pinned unchanged here; WebPage nodes must reference the canonical site
 * Organization and WebSite @ids rendered by the layout and home page.
 */
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { generateBreadcrumbSchema, generateWebPageSchema } from '@/lib/utils/breadcrumb-schema'
import { LOLEV_ORG_ID, LOLEV_WEBSITE_ID } from '@/lib/utils/schema-shared'

vi.mock('next/navigation', () => ({ usePathname: () => '/beer/hazy-ipa' }))
vi.mock('next/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => createElement('a', props, children),
}))

import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'

describe('generateBreadcrumbSchema', () => {
  it('numbers items, links ancestors absolutely, and leaves the current page unlinked', () => {
    const schema = generateBreadcrumbSchema([
      { label: 'Home', href: '/' },
      { label: 'Beer', href: '/beer' },
      { label: 'Hazy IPA', href: '/beer/hazy-ipa' },
    ])
    expect(schema).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lolev.beer/' },
        { '@type': 'ListItem', position: 2, name: 'Beer', item: 'https://lolev.beer/beer' },
        { '@type': 'ListItem', position: 3, name: 'Hazy IPA' },
      ],
    })
  })
})

describe('PageBreadcrumbs', () => {
  it('renders exactly one BreadcrumbList script for the route', () => {
    const html = renderToStaticMarkup(createElement(PageBreadcrumbs))
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
    expect(scripts).toHaveLength(1)
    const schema = JSON.parse(scripts[0][1])
    expect(schema['@type']).toBe('BreadcrumbList')
    const items = schema.itemListElement
    expect(items.map((i: { position: number }) => i.position)).toEqual(
      items.map((_: unknown, index: number) => index + 1),
    )
    expect(items.at(-1)).not.toHaveProperty('item')
    for (const crumb of items.slice(0, -1)) expect(crumb.item).toMatch(/^https:\/\/lolev\.beer\//)
  })
})

describe('generateWebPageSchema', () => {
  it('references the canonical Organization and WebSite ids', () => {
    const page = generateWebPageSchema({ name: 'Privacy', path: '/privacy' })
    expect(page['@id']).toBe('https://lolev.beer/privacy#webpage')
    expect(page.about).toEqual({ '@id': LOLEV_ORG_ID })
    expect(page.isPartOf).toEqual({ '@id': LOLEV_WEBSITE_ID })
  })

  it('keeps a custom baseUrl for the WebPage url, isPartOf, and about', () => {
    const page = generateWebPageSchema(
      { name: 'Privacy', path: '/privacy' },
      'https://staging.example',
    )
    expect(page.url).toBe('https://staging.example/privacy')
    expect(page.isPartOf).toEqual({ '@id': 'https://staging.example/#website' })
    expect(page.about).toEqual({ '@id': 'https://staging.example/#org' })
  })
})
