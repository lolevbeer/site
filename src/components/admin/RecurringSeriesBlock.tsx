/**
 * The recurring block shown above an admin list table (a collection's
 * `beforeListTable` slot): a heading, header actions, and rows laid out in the
 * list's own columns. Shared by the Events list (RecurringEventsPanel) and the
 * Food Bookings list (RecurringFoodPanel), which load and format their rows.
 */
import type React from 'react'
import type { BeforeListTableServerProps, FlattenedField } from 'payload'
import { RecurringSeriesTable } from '@/src/components/admin/RecurringSeriesTable'
import type { RecurringSeriesRow } from '@/src/components/admin/recurring-series-cells'
import './RecurringSeriesBlock.scss'

type ListProps = Pick<BeforeListTableServerProps, 'collectionConfig' | 'i18n' | 'listPreferences'>

/** A field's list-column heading: our labels are strings, Payload's own (dates) functions. */
function fieldLabel(field: FlattenedField, i18n: ListProps['i18n']): string {
  const { label } = field
  if (typeof label === 'function') return label({ i18n, t: i18n.t })
  return typeof label === 'string' ? label : ''
}

/**
 * The list's columns, decided the way Payload does (the viewer's saved choice,
 * else the defaults), and their header text, with `date` headed "Repeats" since
 * a recurring row has a pattern instead. `_select` is the list's checkbox
 * column, kept as an empty spacer.
 */
export function listColumns({ collectionConfig, i18n, listPreferences }: ListProps): {
  columns: string[]
  labels: Record<string, string>
} {
  const saved = listPreferences?.columns?.filter((column) => column.active) ?? []
  const columns = [
    '_select',
    ...(saved.length > 0
      ? saved.map((column) => column.accessor)
      : (collectionConfig.admin.defaultColumns ?? [])),
  ]

  const labels: Record<string, string> = {}
  for (const field of collectionConfig.flattenedFields) {
    labels[field.name] = fieldLabel(field, i18n)
  }
  labels.id ??= 'ID'
  labels.date = 'Repeats'
  return { columns, labels }
}

interface Props {
  /** Heading, also the section's accessible name. */
  title: string
  /** Header links and buttons, right of the heading. */
  actions?: React.ReactNode
  rows: RecurringSeriesRow[]
  columns: string[]
  labels: Record<string, string>
  /** Shown instead of the table when there are no rows. */
  emptyText: string
}

export function RecurringSeriesBlock({
  title,
  actions,
  rows,
  columns,
  labels,
  emptyText,
}: Props): React.JSX.Element {
  // One block per list view, so a fixed id is unique on the page.
  const titleId = 'recurring-series-block-title'
  return (
    <section className="recurring-series-block" aria-labelledby={titleId}>
      <header className="recurring-series-block__header">
        <h2 id={titleId}>{title}</h2>
        {actions}
      </header>
      {rows.length === 0 ? (
        <p className="recurring-series-block__empty">{emptyText}</p>
      ) : (
        // Keyed by the columns: with no dated table to measure, a column change
        // must still reset the table to the new server-side columns.
        <RecurringSeriesTable
          initialColumns={columns}
          key={columns.join(',')}
          labels={labels}
          rows={rows}
        />
      )}
    </section>
  )
}
