/**
 * Dashboard "Menu items" widget: reads one menu as the signed-in user and lists
 * its beers and/or products (per the widget's itemKind setting) in Payload's
 * widget-card markup, each row linking to the item's admin edit page.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MenuItems } from '@/src/components/admin/MenuItems'

// Vite's PostCSS config cannot load in vitest; the widget's styles are not under test.

const findByID = vi.fn()
const req = { payload: { findByID, config: { routes: { admin: '/admin' } } } }

const beer = { id: 'beer-1', name: 'Hazy One', abv: 6.5, style: { name: 'IPA' } }
const product = { id: 'prod-1', name: 'Cider', abv: 5 }
const menu = {
  id: 'menu-1',
  name: 'Taproom',
  location: { name: 'Lawrenceville' },
  _status: 'published',
  items: [
    { id: 'i1', product: { relationTo: 'beers', value: beer } },
    { id: 'i2', product: { relationTo: 'products', value: product } },
  ],
}

async function render(widgetData?: { menu?: string; itemKind?: string }) {
  const element = await MenuItems({ req, widgetData } as never)
  return renderToStaticMarkup(element)
}

describe('MenuItems widget', () => {
  beforeEach(() => {
    findByID.mockReset()
    findByID.mockResolvedValue(menu)
  })

  it('reads the menu as the signed-in user', async () => {
    await render({ menu: 'menu-1' })
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'menus', id: 'menu-1', overrideAccess: false, req }),
    )
  })

  it('links each row to its admin edit page', async () => {
    const html = await render({ menu: 'menu-1' })
    expect(html).toContain('href="/admin/collections/beers/beer-1"')
    expect(html).toContain('href="/admin/collections/products/prod-1"')
    expect(html).toContain('href="/admin/collections/menus/menu-1"')
    expect(html).toContain('class="widget-card__row-link"')
  })

  it('lists only beers for itemKind "beers"', async () => {
    const html = await render({ menu: 'menu-1', itemKind: 'beers' })
    expect(html).toContain('Hazy One')
    expect(html).not.toContain('Cider')
  })

  it('lists only products for itemKind "products"', async () => {
    const html = await render({ menu: 'menu-1', itemKind: 'products' })
    expect(html).toContain('Cider')
    expect(html).not.toContain('Hazy One')
  })

  it('renders the empty state for a menu with no items', async () => {
    findByID.mockResolvedValue({ ...menu, items: [] })
    const html = await render({ menu: 'menu-1' })
    expect(html).toContain('class="widget-card__empty"')
    expect(html).not.toContain('widget-card__rows')
  })

  it('renders without inline style attributes', async () => {
    expect(await render({ menu: 'menu-1' })).not.toContain('style=')
    expect(await render()).not.toContain('style=')
  })
})
