/**
 * Dashboard widget listing one menu's beers and/or products (picked in the
 * widget's settings), each linking to its admin edit page. Renders Payload's
 * widget-card markup plus the shared dashboard-widgets.scss layout classes.
 */
import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { formatAbv } from '@/lib/utils/formatters'
import { extractBeerFromMenuItem, extractProductFromMenuItem } from '@/lib/utils/menu-item-utils'
import { relationshipId } from '@/src/utils/relationship-id'
import type { MenuItemsWidget } from '@/src/payload-types'
import './dashboard-widgets.scss'

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
    <div className="card widget-card lolev-widget">
      <div className="widget-card__header">
        <h3 className="widget-card__title lolev-widget__title">
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
            className="lolev-widget__header-link"
            href={adminURL('menus', menu.id)}
            aria-label={`Edit menu: ${menu.name}`}
          >
            Edit menu
          </Link>
        )}
      </div>
      {!menu ? (
        <p className="widget-card__empty">
          {menuId
            ? 'This menu is unavailable. Choose a readable menu in this widget’s settings.'
            : 'Choose a menu in this widget’s settings.'}
        </p>
      ) : (
        <>
          <p className="lolev-widget__meta" title={locationName}>
            {items.length} {noun}
            {locationName ? ` · ${locationName}` : ''}
            {menu._status === 'draft' ? ' · Draft menu' : ''}
          </p>
          {items.length === 0 ? (
            <p className="widget-card__empty">No readable {noun} on this menu.</p>
          ) : (
            <ul className="widget-card__rows">
              {items.map((item) => (
                <li key={item.key} className="widget-card__row">
                  <Link
                    className="widget-card__row-link"
                    href={item.href}
                    title={[item.name, item.details].filter(Boolean).join(' · ')}
                  >
                    <span className="widget-card__row-main">
                      <span className="widget-card__row-title">{item.name}</span>
                      {item.promotion && (
                        <span className="lolev-widget__note">{item.promotion}</span>
                      )}
                    </span>
                    {item.abv && (
                      <span className="widget-card__row-meta" aria-label={`${item.abv} ABV`}>
                        {item.abv}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
