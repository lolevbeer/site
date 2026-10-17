'use client'

/**
 * Beers list-view cells for the Untappd URL and Tag columns. A filled cell
 * renders Payload's DefaultCell; an empty one, for users who may update beers,
 * is a Payload Select that fills the blank in place.
 *
 * Saves PATCH /api/beers/:id, which runs Beers' access rules and hooks (the
 * Untappd URL triggers the rating fetch). Payload merges a PATCH over the
 * latest version, so a beer whose latest version is a draft must save with
 * ?draft=true or the merge would publish the pending draft. The status is read
 * fresh at save time: the list only selects visible columns, so the row's
 * `_status` is missing whenever the Status column is hidden.
 */
import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import { DefaultCell, Select, useAuth } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'
import type { UntappdSearchResult } from '@/src/app/api/untappd/route'
import { logger } from '@/lib/utils/logger'

type Option = { label: string; value: string }
type SelectProps = ComponentProps<typeof Select>

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: string
    errors?: { message?: string }[]
  } | null
  return body?.errors?.[0]?.message || body?.error || `${fallback} (${res.status})`
}

async function saveBeerField(id: string, field: 'untappd' | 'tag', value: string) {
  const beerURL = `/api/beers/${encodeURIComponent(id)}`
  const latest = await fetch(`${beerURL}?draft=true&depth=0&select[_status]=true`, {
    credentials: 'same-origin',
  })
  if (!latest.ok) throw new Error(await errorMessage(latest, 'Could not read beer'))
  const { _status } = (await latest.json()) as { _status?: string }

  const res = await fetch(`${beerURL}${_status === 'published' ? '' : '?draft=true'}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [field]: value }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Save failed'))
}

/** True when the cell is blank and the signed-in user may update beers. */
function useEditable(cellData: unknown) {
  const canUpdate = Boolean(useAuth().permissions?.collections?.beers?.update)
  const empty = cellData === null || cellData === undefined || cellData === ''
  return { empty, editable: empty && canUpdate }
}

/** The editable cell: a Select whose chosen option is saved to `field`, plus any error. */
function FillSelect({
  rowId,
  field,
  minWidth,
  loadError,
  selectProps,
}: {
  rowId: string
  field: 'untappd' | 'tag'
  minWidth: number
  loadError: string | null
  selectProps: Omit<SelectProps, 'onChange' | 'disabled' | 'menuPortalTarget'>
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const error = loadError ?? saveError

  async function save(value: string) {
    setSaving(true)
    setSaveError(null)
    try {
      await saveBeerField(rowId, field, value)
      router.refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minWidth }}>
      <Select
        {...selectProps}
        disabled={saving}
        // Portal the menu so the table's overflow doesn't clip it.
        menuPortalTarget={typeof document === 'undefined' ? null : document.body}
        onChange={(option) => {
          if (!Array.isArray(option) && typeof option?.value === 'string') void save(option.value)
        }}
      />
      {error && (
        <span role="alert" style={{ color: 'var(--theme-error-500)', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  )
}

const normalizeName = (name: string) => name.trim().toLowerCase()

/** Exact (case-insensitive) name match first, marked ★; a lone result counts as the match. */
function toOptions(results: UntappdSearchResult[], beerName: string): Option[] {
  const isMatch = (r: UntappdSearchResult) =>
    results.length === 1 || normalizeName(r.name) === normalizeName(beerName)
  const toOption = (r: UntappdSearchResult, star: boolean) => ({
    label: `${star ? '★ ' : ''}${r.name}${r.brewery ? ` · ${r.brewery}` : ''}`,
    value: r.url,
  })
  const matches = results.filter(isMatch)
  const rest = results.filter((r) => !matches.includes(r))
  return [...matches.map((r) => toOption(r, true)), ...rest.map((r) => toOption(r, false))]
}

export function UntappdCell(props: DefaultCellComponentProps) {
  const { empty, editable } = useEditable(props.cellData)
  const beerName = String(props.rowData.name ?? '')
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const lastQuery = useRef<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(debounce.current), [])

  if (!empty) return <DefaultCell {...props} />
  if (!editable) return null

  // Untappd rate-limits us, so search only when asked: on open (by beer name)
  // and on typed text, debounced, never for every row on page load.
  async function search(query: string) {
    const q = query.trim()
    if (!q || q === lastQuery.current) return
    lastQuery.current = q
    setLoading(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/untappd?action=search&q=${encodeURIComponent(q)}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(await errorMessage(res, 'Search failed'))
      const body = (await res.json()) as { results?: UntappdSearchResult[] }
      // A newer query superseded this one while it was in flight.
      if (lastQuery.current === q) setOptions(toOptions(body.results ?? [], beerName))
    } catch (err) {
      lastQuery.current = null
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  // react-select passes { action }, and also reports '' on blur/menu close; only typing searches.
  const onInputChange = ((text: string, meta?: { action?: string }) => {
    if (meta && meta.action !== 'input-change') return
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => void search(text || beerName), 400)
  }) as SelectProps['onInputChange']

  return (
    <FillSelect
      rowId={String(props.rowData.id)}
      field="untappd"
      minWidth={220}
      loadError={searchError}
      selectProps={{
        'aria-label': 'Untappd URL',
        placeholder: 'Find on Untappd…',
        options,
        isLoading: loading,
        // Untappd already filtered server-side; don't hide results that don't contain the typed text.
        filterOption: () => true,
        noOptionsMessage: () => (loading ? 'Searching Untappd…' : 'No Untappd results'),
        onMenuOpen: () => void search(beerName),
        onInputChange,
      }}
    />
  )
}

/** One tags request shared by every Tag cell on the page; cleared on failure so a retry refetches. */
let tagsRequest: Promise<Option[]> | null = null
function loadTags(): Promise<Option[]> {
  tagsRequest ??= fetch('/api/tags?limit=100&sort=name&depth=0', { credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not load tags'))
      const body = (await res.json()) as { docs: { id: string; name: string }[] }
      return body.docs.map((tag) => ({ label: tag.name, value: tag.id }))
    })
    .catch((err: unknown) => {
      tagsRequest = null
      throw err
    })
  return tagsRequest
}

/** Test seam: forget the shared tags request between tests. */
export function resetTagsRequest() {
  tagsRequest = null
}

export function TagCell(props: DefaultCellComponentProps) {
  const { empty, editable } = useEditable(props.cellData)
  const [tags, setTags] = useState<Option[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!empty) return <DefaultCell {...props} />
  if (!editable) return null

  // Loaded on first open, not on mount, so a page of blank rows makes no request until one is used.
  // The spinner shows only during that fetch: an idle blank cell must not look busy, since a tag is optional.
  function open() {
    if (tags) return
    setLoadError(null)
    setLoading(true)
    loadTags()
      .then(setTags)
      .catch((err: unknown) => {
        logger.error('Failed to load tags for Beers list', err)
        setLoadError(err instanceof Error ? err.message : 'Could not load tags')
      })
      .finally(() => setLoading(false))
  }

  return (
    <FillSelect
      rowId={String(props.rowData.id)}
      field="tag"
      minWidth={160}
      loadError={loadError}
      selectProps={{
        'aria-label': 'Tag',
        placeholder: 'Set tag…',
        options: tags ?? [],
        isLoading: loading,
        onMenuOpen: open,
      }}
    />
  )
}
