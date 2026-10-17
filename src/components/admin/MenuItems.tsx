/**
 * Dashboard widget listing one menu's beers and/or products (picked in the
 * widget's settings), each linking to its admin edit page.
 */
import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { formatAbv } from '@/lib/utils/formatters'
import { extractBeerFromMenuItem, extractProductFromMenuItem } from '@/lib/utils/menu-item-utils'
import { relationshipId } from '@/src/utils/relationship-id'
import type { MenuItemsWidget } from '@/src/payload-types'

/**
 * The menu with only the fields the widget renders. Not cached: draft-only
 * saves skip revalidation, and this widget shows draft menus to their editors.
 */
const loadMenu = (req: WidgetServerProps['req'], menuId: string) =>
  req.payload.findByID({
    collection: 'menus',
    id: menuId,
    depth: 2,
    select: { name: true, location: true, items: true, _status: true },
    populate: {
      beers: { name: true, abv: true, style: true },
      products: { name: true, abv: true },
      styles: { name: true },
      locations: { name: true },
    },
    disableErrors: true,
    overrideAccess: false,
    req,
  })

/** Each dashboard instance selects its own menu and item kind. */
export async function MenuItems({ req, widgetData }: WidgetServerProps<MenuItemsWidget>) {
  const selection = widgetData?.menu
  const menuId = selection ? relationshipId(selection) : undefined
  const menu = menuId ? await loadMenu(req, menuId) : null
  const adminRoute = req.payload.config.routes.admin
  const adminURL = (collection: string, id: string) =>
    formatAdminURL({ adminRoute, path: `/collections/${collection}/${encodeURIComponent(id)}` })
  const kind = widgetData?.itemKind
  const noun = kind === 'beers' || kind === 'products' ? kind : 'items'
  const locationName =
    menu && typeof menu.location === 'object' && menu.location ? menu.location.name : undefined
  const ellipsis = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const
  const items = (menu?.items || []).flatMap((item, index) => {
    const beer = extractBeerFromMenuItem(item)
    const product = extractProductFromMenuItem(item)
    const entry = kind === 'beers' ? beer : kind === 'products' ? product : beer || product
    // Denied relationships remain IDs; omit them, just as the public menus do.
    if (!entry) return []
    const style = beer?.style && typeof beer.style === 'object' ? beer.style.name : undefined
    const details = [style, entry.abv != null ? formatAbv(entry.abv, true) : undefined]
      .filter(Boolean)
      .join(' · ')
    return [
      {
        key: item.id || String(index),
        name: entry.name,
        href: adminURL(beer ? 'beers' : 'products', entry.id),
        details,
        abv: entry.abv != null ? formatAbv(entry.abv) : null,
        promotion: item.promotion,
      },
    ]
  })

  return (
    <div className="card widget-card" style={{ maxHeight: 'none', padding: 12, gap: 0 }}>
      <div className="widget-card__header" style={{ marginBottom: 4, gap: 8 }}>
        <h3
          className="widget-card__title"
          style={{
            fontSize: 16,
            lineHeight: 1.25,
            margin: 0,
            minWidth: 0,
            ...ellipsis,
          }}
        >
          {menu ? (
            <Link href={adminURL('menus', menu.id)} title={menu.name}>
              {menu.name}
            </Link>
          ) : (
            'Menu items'
          )}
        </h3>
        {menu && (
          <Link
            href={adminURL('menus', menu.id)}
            aria-label={`Edit menu: ${menu.name}`}
            style={{ fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Edit menu
          </Link>
        )}
      </div>
      {!menu ? (
        <p>
          {menuId
            ? 'This menu is unavailable. Choose a readable menu in this widget’s settings.'
            : 'Choose a menu in this widget’s settings.'}
        </p>
      ) : (
        <>
          <p
            title={locationName}
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              margin: '0 0 6px',
              ...ellipsis,
            }}
          >
            {items.length} {noun}
            {locationName ? ` · ${locationName}` : ''}
            {menu._status === 'draft' ? ' · Draft menu' : ''}
          </p>
          {items.length === 0 ? (
            <p>No readable {noun} on this menu.</p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {items.map((item) => (
                <li
                  key={item.key}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '2px 8px',
                    padding: '4px 0',
                    lineHeight: 1.3,
                    borderTop: '1px solid var(--theme-elevation-150)',
                  }}
                >
                  <Link
                    href={item.href}
                    title={[item.name, item.details].filter(Boolean).join(' · ')}
                    style={{
                      fontSize: 14,
                      flex: 1,
                      minWidth: 0,
                      ...ellipsis,
                    }}
                  >
                    {item.name}
                  </Link>
                  {item.abv && (
                    <small
                      aria-label={`${item.abv} ABV`}
                      style={{ fontSize: 12, flexShrink: 0, color: 'var(--color-text-secondary)' }}
                    >
                      {item.abv}
                    </small>
                  )}
                  {item.promotion && (
                    <small style={{ flexBasis: '100%', fontSize: 12 }}>{item.promotion}</small>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
