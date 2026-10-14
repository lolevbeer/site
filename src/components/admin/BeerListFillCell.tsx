'use client'

/**
 * Beers list-view cells for the Untappd URL and Tag columns. A filled cell
 * renders Payload's DefaultCell; an empty one, for users who may update beers,
 * offers Payload's Select so blanks can be filled without opening each beer:
 * - Untappd: opening the select searches Untappd by the beer's name (the same
 *   /api/untappd search the edit view's UntappdFetcher uses); typing searches
 *   again. An exact name match is listed first and marked ★.
 * - Tag: the existing tags.
 *
 * Saves PATCH /api/beers/:id, which runs Beers' access rules and hooks (the
 * Untappd URL triggers the rating fetch). Payload merges a PATCH over the
 * latest version, so a beer whose latest version is a draft must save with
 * ?draft=true; otherwise the merge would publish the pending draft.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DefaultCell, Select, useAuth } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'

type RowData = DefaultCellComponentProps['rowData']

function useSaveBeerField(rowData: RowData, field: 'untappd' | 'tag') {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Resolves true once saved, so callers can close their UI. */
  async function save(value: string): Promise<boolean> {
    setSaving(true)
    setError(null)
    const draft = rowData._status === 'published' ? '' : '?draft=true'
    try {
      const res = await fetch(`/api/beers/${encodeURIComponent(String(rowData.id))}${draft}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          errors?: { message?: string }[]
        } | null
        throw new Error(body?.errors?.[0]?.message || `Save failed (${res.status})`)
      }
      router.refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  return { save, saving, error }
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === ''

function useCanUpdateBeers() {
  return Boolean(useAuth().permissions?.collections?.beers?.update)
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <span role="alert" style={{ color: 'var(--theme-error-500)', display: 'block' }}>
      {error}
    </span>
  ) : null
}

type UntappdResult = { name: string; url: string; brewery?: string }
type Option = { label: string; value: string }

const normalizeName = (name: string) => name.trim().toLowerCase()

/** Exact (case-insensitive) name match first, marked ★; a lone result counts as the match. */
function toOptions(results: UntappdResult[], beerName: string): Option[] {
  const isMatch = (r: UntappdResult) =>
    results.length === 1 || normalizeName(r.name) === normalizeName(beerName)
  return [...results]
    .sort((a, b) => Number(isMatch(b)) - Number(isMatch(a)))
    .map((r) => ({
      label: `${isMatch(r) ? '★ ' : ''}${r.name}${r.brewery ? ` · ${r.brewery}` : ''}`,
      value: r.url,
    }))
}

export function UntappdCell(props: DefaultCellComponentProps) {
  const canUpdate = useCanUpdateBeers()
  const beerName = String(props.rowData.name ?? '')
  const [options, setOptions] = useState<Option[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const { save, saving, error } = useSaveBeerField(props.rowData, 'untappd')
  const lastQuery = useRef<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(debounce.current), [])

  if (!isEmpty(props.cellData)) return <DefaultCell {...props} />
  if (!canUpdate) return null

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
      const body = (await res.json()) as { results?: UntappdResult[]; error?: string }
      if (!res.ok) throw new Error(body.error || `Search failed (${res.status})`)
      // A newer query superseded this one while it was in flight.
      if (lastQuery.current === q) setOptions(toOptions(body.results ?? [], beerName))
    } catch (err) {
      lastQuery.current = null
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minWidth: 220 }}>
      <Select
        aria-label="Untappd URL"
        placeholder="Find on Untappd…"
        options={options ?? []}
        isLoading={loading}
        disabled={saving}
        // Untappd already filtered server-side; don't hide results that don't contain the typed text.
        filterOption={() => true}
        noOptionsMessage={() => (loading ? 'Searching Untappd…' : 'No Untappd results')}
        menuPortalTarget={typeof document === 'undefined' ? null : document.body}
        onMenuOpen={() => void search(beerName)}
        onInputChange={(text) => {
          clearTimeout(debounce.current)
          debounce.current = setTimeout(() => void search(text || beerName), 400)
        }}
        onChange={(option) => {
          if (!Array.isArray(option) && typeof option?.value === 'string') void save(option.value)
        }}
      />
      <ErrorText error={searchError ?? error} />
    </div>
  )
}

export function TagCell(props: DefaultCellComponentProps) {
  const canUpdate = useCanUpdateBeers()
  const empty = isEmpty(props.cellData)
  const [tags, setTags] = useState<Option[] | null>(null)
  const { save, saving, error } = useSaveBeerField(props.rowData, 'tag')

  // ponytail: one tags fetch per empty row; share a cache if the list grows past a page of blanks.
  useEffect(() => {
    if (!empty || !canUpdate) return
    const controller = new AbortController()
    fetch('/api/tags?limit=100&sort=name&depth=0', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((res) => res.json() as Promise<{ docs: { id: string; name: string }[] }>)
      .then((body) => setTags(body.docs.map((tag) => ({ label: tag.name, value: tag.id }))))
      .catch(() => {})
    return () => controller.abort()
  }, [empty, canUpdate])

  if (!empty) return <DefaultCell {...props} />
  if (!canUpdate) return null

  return (
    <div style={{ minWidth: 160 }}>
      <Select
        aria-label="Tag"
        placeholder="Set tag…"
        options={tags ?? []}
        isLoading={!tags}
        disabled={saving}
        menuPortalTarget={typeof document === 'undefined' ? null : document.body}
        onChange={(option) => {
          if (!Array.isArray(option) && typeof option?.value === 'string') void save(option.value)
        }}
      />
      <ErrorText error={error} />
    </div>
  )
}
