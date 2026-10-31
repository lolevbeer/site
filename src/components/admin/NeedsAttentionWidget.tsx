/**
 * Dashboard "Needs attention" widget: draft lines due or overdue for cleaning,
 * new submissions waiting in each inbox, and menus off target, as Payload
 * widget-card rows (lib/admin/needs-attention builds them). Every read runs as
 * the signed-in user; a collection they cannot read contributes no row. Lines
 * rows keep the old lines-cleaned banner's audience: admins see every
 * location, lead bartenders their assigned ones, everyone else none.
 *
 * The widget's `location` setting pins one location. Otherwise a (lead)
 * bartender assigned to several locations gets tabs to switch between them.
 */
import Link from 'next/link'
import type React from 'react'
import type { PayloadRequest, WidgetServerProps } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { Pill } from '@payloadcms/ui'
import { loadMenuTargets, summarizeMenuTarget } from '@/lib/admin/menu-targets'
import {
  buildAttentionRows,
  type AttentionInput,
  type AttentionRow,
} from '@/lib/admin/needs-attention'
import { getUserLocationIds, hasRole } from '@/src/access/roles'
import { MarkCleanedRowButton } from '@/src/components/admin/MarkCleanedRowButton'
import { AttentionHeader, NeedsAttentionTabs } from '@/src/components/admin/NeedsAttentionTabs'
import type { User } from '@/src/payload-types'
import { relationshipId } from '@/src/utils/relationship-id'
import './dashboard-widgets.scss'
import './NeedsAttentionWidget.scss'

// Until the widget is registered and payload-types regenerated (NeedsAttentionWidget).
type WidgetData = { data?: { location?: string | { id: string } | null } }
type Submissions = AttentionInput['inquiries']

const SUBMISSION_LIMIT = 100
const TYPE_LABEL: Record<string, string> = { cans: 'Cans', draft: 'Draft' }

/** New submissions in one inbox collection, oldest first; null when the read is denied. */
async function readNew(
  req: PayloadRequest,
  collection: 'event-inquiries' | 'donation-requests' | 'job-applications',
): Promise<Submissions> {
  try {
    const { docs } = await req.payload.find({
      collection,
      where: { status: { equals: 'new' } },
      select: { createdAt: true },
      sort: 'createdAt',
      depth: 0,
      limit: SUBMISSION_LIMIT,
      overrideAccess: false,
      req,
    })
    return docs.map((doc) => ({ id: doc.id, createdAt: doc.createdAt }))
  } catch {
    return null
  }
}

/** Menu target rows labelled 'Cans · Zelienople'; empty when the viewer reads no menus. */
async function readMenuTargets(req: PayloadRequest): Promise<AttentionInput['menuTargets']> {
  const targets = await loadMenuTargets(req).catch(() => null)
  if (!targets) return []
  const timelines = new Map(targets.timelines)
  return targets.rows.flatMap(({ location, atLocation }) =>
    atLocation.map((menu) => {
      const timeline = timelines.get(menu.id)
      return {
        menuId: menu.id,
        label: `${TYPE_LABEL[menu.type] ?? menu.type} · ${location.name}`,
        locationId: location.id,
        summary: timeline ? summarizeMenuTarget(timeline) : null,
      }
    }),
  )
}

export async function NeedsAttentionWidget({
  req,
  widgetData,
}: WidgetServerProps<WidgetData>): Promise<React.JSX.Element> {
  const user = req.user as User | null
  const isAdmin = hasRole(user, 'admin')
  const assigned = getUserLocationIds(user)
  // Mirrors Locations `update` access: admins any location, lead bartenders their own.
  const mayUpdate = (id: string): boolean =>
    isAdmin || (hasRole(user, 'lead-bartender') && assigned.includes(id))

  const [inquiries, donations, applications, locations, menuTargets] = await Promise.all([
    readNew(req, 'event-inquiries'),
    readNew(req, 'donation-requests'),
    readNew(req, 'job-applications'),
    req.payload.find({
      collection: 'locations',
      select: { name: true, linesLastCleaned: true },
      sort: 'name',
      depth: 0,
      limit: 100,
      overrideAccess: false,
      req,
    }),
    readMenuTargets(req),
  ])

  const input: AttentionInput = {
    inquiries,
    donations,
    applications,
    locations: locations.docs.filter((location) => mayUpdate(location.id)),
    menuTargets,
    now: new Date(),
  }
  const adminRoute = req.payload.config.routes.admin
  const list = (locationId?: string): { count: number; rows: React.ReactNode } => {
    const rows = buildAttentionRows({ ...input, locationId })
    return {
      count: rows.length,
      rows: <AttentionList rows={rows} adminRoute={adminRoute} mayUpdate={mayUpdate} />,
    }
  }

  const pinned = widgetData?.location ? relationshipId(widgetData.location) : undefined
  const tabLocations =
    !pinned && !isAdmin && hasRole(user, ['bartender', 'lead-bartender'])
      ? locations.docs.filter((location) => assigned.includes(location.id))
      : []

  if (tabLocations.length > 1) {
    const panels = tabLocations.map((location) => ({
      value: location.id,
      label: location.name,
      ...list(location.id),
    }))
    return (
      <div className="card widget-card lolev-widget needs-attention">
        <NeedsAttentionTabs panels={panels} />
      </div>
    )
  }

  const { count, rows } = list(pinned)
  return (
    <div className="card widget-card lolev-widget needs-attention">
      <AttentionHeader count={count} />
      {rows}
    </div>
  )
}

function AttentionList({
  rows,
  adminRoute,
  mayUpdate,
}: {
  rows: AttentionRow[]
  adminRoute: string
  mayUpdate: (locationId: string) => boolean
}): React.JSX.Element {
  if (rows.length === 0) return <p className="widget-card__empty">Nothing needs attention.</p>
  return (
    <ul className="widget-card__rows">
      {rows.map((row) => (
        <li key={row.key} className="widget-card__row needs-attention__row">
          <Link
            className="widget-card__row-link"
            href={formatAdminURL({ adminRoute, path: row.href as `/${string}` })}
          >
            <Pill pillStyle={row.pillStyle} size="small">
              {row.pill}
            </Pill>
            <span className="widget-card__row-main">
              <span className="widget-card__row-title">{row.title}</span>
              {row.meta && <span className="lolev-widget__note">{row.meta}</span>}
            </span>
          </Link>
          {row.action?.kind === 'mark-cleaned' && mayUpdate(row.action.locationId) && (
            <MarkCleanedRowButton locationId={row.action.locationId} rowTitle={row.title} />
          )}
        </li>
      ))}
    </ul>
  )
}
