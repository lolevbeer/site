'use client'

/**
 * The rows of the "Recurring series" block (RecurringEventsPanel), laid out in
 * the same columns as the Dated Events table below so the two stack as one.
 *
 * Two separate tables size their columns from their own content, so CSS alone
 * cannot line them up. This component reads the dated table's rendered header
 * (which columns, in what order, how wide) and copies it, again whenever that
 * table is replaced or any of its columns changes width. Until it has measured
 * (or when there is no dated table: an empty list, the grid layout), it renders
 * `initialColumns` at natural widths.
 *
 * It depends on Payload's list markup: tables inside `.collection-list`, header
 * cells carrying `data-column`. If that markup changes, measuring is skipped
 * and the block keeps `initialColumns`. With group-by, it follows the first group.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { Link, Pill } from '@payloadcms/ui'

export interface RecurringEventsRow {
  id: string
  href: string
  paused: boolean
  /** Cell text keyed by the dated list's column names; missing columns render blank. */
  cells: Record<string, string>
}

interface Column {
  accessor: string
  width?: number
}

interface Props {
  rows: RecurringEventsRow[]
  /** Header text per column name. */
  labels: Record<string, string>
  /** Columns to show until the dated table has been measured. */
  initialColumns: string[]
}

/** The dated table's checkbox column; an empty spacer here. */
const SELECT_COLUMN = '_select'

/** Header cells of the dated table: the first table in the list view that is not ours. */
function datedHeaderCells(panelTable: HTMLTableElement): HTMLTableCellElement[] {
  const tables = panelTable.closest('.collection-list')?.querySelectorAll('table') ?? []
  const dated = [...tables].find((table) => table !== panelTable)
  return dated ? [...dated.querySelectorAll<HTMLTableCellElement>('thead th')] : []
}

export function RecurringEventsTable({ rows, labels, initialColumns }: Props): React.JSX.Element {
  const tableRef = useRef<HTMLTableElement>(null)
  const [columns, setColumns] = useState<Column[]>(() =>
    initialColumns.map((accessor) => ({ accessor })),
  )

  // Layout effect, so the copied widths are applied before the first paint.
  useLayoutEffect(() => {
    const panelTable = tableRef.current
    const listView = panelTable?.closest('.collection-list')
    if (!panelTable || !listView) return

    let watched: HTMLTableCellElement[] = []
    const resizes = new ResizeObserver(sync)

    function sync(): void {
      const headerCells = datedHeaderCells(panelTable!)
      const next = headerCells.map((th) => ({
        accessor: th.dataset.column ?? '',
        width: th.getBoundingClientRect().width,
      }))
      // No dated table, or markup we don't recognise: keep the columns we have.
      if (next.length === 0 || next.some((column) => !column.accessor)) return

      // Watch each header cell's width. Re-watch only when the cells themselves
      // changed, because observing a cell fires the observer once straight away.
      if (headerCells.some((th, index) => th !== watched[index])) {
        resizes.disconnect()
        headerCells.forEach((th) => resizes.observe(th))
        watched = headerCells
      }

      // Our own re-render also triggers the observers; only update on a real change.
      setColumns((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
    }

    sync()
    // Payload replaces the table when columns change, so watch the whole list view.
    const mutations = new MutationObserver(sync)
    mutations.observe(listView, { childList: true, subtree: true })
    return () => {
      mutations.disconnect()
      resizes.disconnect()
    }
  }, [])

  // Fixed layout needs a definite table width to honour the column widths exactly;
  // otherwise long text (a URL) widens its column and pushes the rest out of line.
  const measured = columns.every((column) => column.width !== undefined)
  const totalWidth = columns.reduce((sum, column) => sum + (column.width ?? 0), 0)

  // Like Payload's list, the first real column carries the link to the document.
  const linkedColumn = columns.find((column) => column.accessor !== SELECT_COLUMN)?.accessor

  return (
    // Payload's own `.table` class, so rows look like the dated table below.
    <div className="table">
      <table
        cellPadding="0"
        cellSpacing="0"
        ref={tableRef}
        // ponytail: if the dated table scrolls sideways the two scroll separately.
        // Sync scrollLeft if that ever matters.
        style={measured ? { tableLayout: 'fixed', minWidth: 0, width: totalWidth } : undefined}
      >
        <colgroup>
          {columns.map(({ accessor, width }) => (
            <col key={accessor} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map(({ accessor }) => (
              <th className={`heading-${accessor}`} key={accessor} scope="col">
                {labels[accessor]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map(({ accessor }) =>
                accessor === linkedColumn ? (
                  <td className="cell--linked" key={accessor}>
                    <Link href={row.href} prefetch={false}>
                      {/* A blank value still needs something to click. */}
                      {row.cells[accessor] || row.cells.organizer}
                      {row.paused && (
                        <Pill pillStyle="warning" size="small">
                          Paused
                        </Pill>
                      )}
                    </Link>
                  </td>
                ) : (
                  <td className={`cell-${accessor}`} key={accessor}>
                    {row.cells[accessor]}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
