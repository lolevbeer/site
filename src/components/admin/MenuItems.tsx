import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { extractBeerFromMenuItem, extractProductFromMenuItem } from '@/lib/utils/menu-item-utils'
import { relationshipId } from '@/src/utils/relationship-id'
import type { MenuItemsWidget } from '@/src/payload-types'

/** Each dashboard instance selects its own menu and item kind. Reads are never shared across users. */
export async function MenuItems({ req, widgetData }: WidgetServerProps<MenuItemsWidget>) {
  const selection = widgetData?.menu
  const menuId = selection ? relationshipId(selection) : undefined
  const menu = menuId
    ? await req.payload.findByID({
        collection: 'menus',
        id: menuId,
        depth: 2,
        disableErrors: true,
        overrideAccess: false,
        req,
      })
    : null
  const adminRoute = req.payload.config.routes.admin
  const adminURL = (collection: string, id: string) =>
    formatAdminURL({ adminRoute, path: `/collections/${collection}/${encodeURIComponent(id)}` })
  const kind = widgetData?.itemKind
  const items = (menu?.items || []).flatMap((item, index) => {
    const beer = extractBeerFromMenuItem(item)
    const product = extractProductFromMenuItem(item)
    if ((kind === 'beers' && !beer) || (kind === 'products' && !product)) return []
    const entry = beer || product
    // Denied relationships remain IDs; omit them, just as the public menus do.
    if (!entry) return []
    const style = beer?.style && typeof beer.style === 'object' ? beer.style.name : undefined
    const details = [style, entry.abv != null ? `${entry.abv}% ABV` : undefined]
      .filter(Boolean)
      .join(' · ')
    return [
      {
        key: item.id || String(index),
        name: entry.name,
        href: adminURL(beer ? 'beers' : 'products', entry.id),
        details,
        abv: entry.abv != null ? `${entry.abv}%` : null,
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
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
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
            title={
              typeof menu.location === 'object' && menu.location ? menu.location.name : undefined
            }
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              margin: '0 0 6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {items.length} {kind === 'beers' ? 'beers' : kind === 'products' ? 'products' : 'items'}
            {typeof menu.location === 'object' && menu.location ? ` · ${menu.location.name}` : ''}
            {menu._status === 'draft' ? ' · Draft menu' : ''}
          </p>
          {items.length === 0 ? (
            <p>
              No readable {kind === 'beers' ? 'beers' : kind === 'products' ? 'products' : 'items'}{' '}
              on this menu.
            </p>
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
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
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
