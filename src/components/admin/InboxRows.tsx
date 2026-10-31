'use client'

/**
 * Client list for the dashboard Inbox widget (InboxWidget): kind filter tabs
 * with counts, and per row a kind label, a title that opens the document in
 * Payload's document drawer, the detail line, how long it has waited, an Email
 * link, and a button that marks it handled. Status changes go through the REST
 * API as the signed-in user, so collection update access decides who may.
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Tabs, toast, useDocumentDrawer, useTranslation } from '@payloadcms/ui'
import {
  formatRelativeDate,
  getRelativeTimeFormat,
} from '@payloadcms/ui/utilities/formatRelativeDate'
import type { InboxRow } from '@/lib/admin/inbox'

export type InboxKind = 'all' | 'events' | 'donations' | 'jobs'

const TABS: Array<{ value: InboxKind; label: string; rowKind?: InboxRow['kind'] }> = [
  { value: 'all', label: 'All' },
  { value: 'events', label: 'Events', rowKind: 'Event' },
  { value: 'donations', label: 'Donations', rowKind: 'Donation' },
  { value: 'jobs', label: 'Jobs', rowKind: 'Job' },
]

function rowsOfKind(rows: InboxRow[], kind: InboxKind): InboxRow[] {
  const rowKind = TABS.find((tab) => tab.value === kind)?.rowKind
  return rowKind ? rows.filter((row) => row.kind === rowKind) : rows
}

/** Sets the row's handled status as the signed-in user; throws on a non-2xx response. */
async function markHandled(row: InboxRow): Promise<void> {
  const response = await fetch(`/api/${row.collection}/${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: row.handledStatus }),
  })
  if (!response.ok) throw new Error(`Status update failed (${response.status})`)
}

function InboxRowItem({
  row,
  relativeTimeFormat,
}: {
  row: InboxRow
  relativeTimeFormat: Intl.RelativeTimeFormat
}): React.JSX.Element {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [DocumentDrawer, , { openDrawer, isDrawerOpen }] = useDocumentDrawer({
    collectionSlug: row.collection,
    id: row.id,
  })

  // Refresh once the drawer closes (after a save or not), so the row reflects
  // its new status. Refreshing while it is open could unmount this row, and
  // the drawer with it, mid-edit.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !isDrawerOpen) router.refresh()
    wasOpen.current = isDrawerOpen
  }, [isDrawerOpen, router])

  function openInDrawer(event: MouseEvent<HTMLAnchorElement>): void {
    // Modifier clicks keep the link's normal behavior (open in a new tab).
    if (event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    openDrawer()
  }

  async function handle(): Promise<void> {
    setSaving(true)
    try {
      await markHandled(row)
      toast.success(`${row.title} marked ${row.handledStatus}.`)
      router.refresh()
    } catch {
      toast.error(`Could not update ${row.title}. Please try again.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="widget-card__row">
      <div className="widget-card__row-link inbox-widget__row">
        <span className="widget-card__row-main">
          <span className="widget-card__type">{row.kind}</span>
          <a className="widget-card__row-title" href={row.href} onClick={openInDrawer}>
            {row.title}
          </a>
          {row.detail && <span className="lolev-widget__note">{row.detail}</span>}
        </span>
        <span className="widget-card__row-meta">
          <time dateTime={row.createdAt}>
            {formatRelativeDate({ relativeTimeFormat, value: row.createdAt })}
          </time>
          {row.mailto && (
            <a href={row.mailto} aria-label={`Email ${row.title}`}>
              Email
            </a>
          )}
          <Button buttonStyle="ghost" type="button" disabled={saving} onClick={() => void handle()}>
            {row.handledLabel}
          </Button>
        </span>
      </div>
      <DocumentDrawer />
    </li>
  )
}

/** `kind` other than 'all' fixes the widget to that kind and hides the tabs. */
export function InboxRows({
  rows,
  kind,
}: {
  rows: InboxRow[]
  kind: InboxKind
}): React.JSX.Element {
  const [tab, setTab] = useState<InboxKind>(kind)
  const { i18n } = useTranslation()
  const relativeTimeFormat = getRelativeTimeFormat(i18n.language)
  const shown = rowsOfKind(rows, kind === 'all' ? tab : kind)

  return (
    <>
      {kind === 'all' && (
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={TABS.map(({ value, label }) => ({
            value,
            label: `${label} (${rowsOfKind(rows, value).length})`,
          }))}
        />
      )}
      {shown.length === 0 ? (
        <p className="widget-card__empty">Nothing waiting.</p>
      ) : (
        <ul className="widget-card__rows">
          {shown.map((row) => (
            <InboxRowItem
              key={`${row.collection}:${row.id}`}
              row={row}
              relativeTimeFormat={relativeTimeFormat}
            />
          ))}
        </ul>
      )}
    </>
  )
}
