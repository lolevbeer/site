'use client'

/**
 * Beers list-view cells for the Untappd URL and Tag columns. A filled cell
 * renders Payload's DefaultCell; an empty one, for users who may update beers,
 * offers a Payload-native way to fill it without opening each beer:
 * - Untappd: a button that searches Untappd by the beer's name (the same
 *   /api/untappd search the edit view's UntappdFetcher uses) and lists the
 *   results in a drawer, marking an exact name match as recommended.
 * - Tag: Payload's Select over the existing tags.
 *
 * Saves PATCH /api/beers/:id, which runs Beers' access rules and hooks (the
 * Untappd URL triggers the rating fetch). Payload merges a PATCH over the
 * latest version, so a beer whose latest version is a draft must save with
 * ?draft=true; otherwise the merge would publish the pending draft.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  DefaultCell,
  Drawer,
  Select,
  useAuth,
  useDrawerSlug,
  useModal,
} from '@payloadcms/ui'
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

const normalizeName = (name: string) => name.trim().toLowerCase()

export function UntappdCell(props: DefaultCellComponentProps) {
  const canUpdate = useCanUpdateBeers()
  const { openModal, closeModal } = useModal()
  const drawerSlug = useDrawerSlug(`untappd-${props.rowData.id}`)
  const [results, setResults] = useState<UntappdResult[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const { save, saving, error } = useSaveBeerField(props.rowData, 'untappd')

  if (!isEmpty(props.cellData)) return <DefaultCell {...props} />
  if (!canUpdate) return null

  const beerName = String(props.rowData.name ?? '')

  async function search() {
    openModal(drawerSlug)
    setResults(null)
    setSearchError(null)
    try {
      const res = await fetch(`/api/untappd?action=search&q=${encodeURIComponent(beerName)}`, {
        credentials: 'same-origin',
      })
      const body = (await res.json()) as { results?: UntappdResult[]; error?: string }
      if (!res.ok) throw new Error(body.error || `Search failed (${res.status})`)
      setResults(body.results ?? [])
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    }
  }

  async function choose(url: string) {
    if (await save(url)) closeModal(drawerSlug)
  }

  // Exact (case-insensitive) name match is the recommendation, listed first;
  // with a single result that one is the recommendation.
  const recommendedUrl =
    results?.length === 1
      ? results[0].url
      : results?.find((r) => normalizeName(r.name) === normalizeName(beerName))?.url
  const ordered = results
    ? [...results].sort(
        (a, b) => Number(b.url === recommendedUrl) - Number(a.url === recommendedUrl),
      )
    : null

  return (
    <>
      <Button buttonStyle="secondary" size="medium" margin={false} onClick={search}>
        Find on Untappd
      </Button>
      <Drawer slug={drawerSlug} title={`Untappd matches for “${beerName}”`}>
        {searchError && <ErrorText error={searchError} />}
        {!searchError && !ordered && <p>Searching Untappd…</p>}
        {ordered?.length === 0 && <p>No Untappd results for “{beerName}”.</p>}
        {ordered && ordered.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
            {ordered.map((result) => (
              <li
                key={result.url}
                style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
              >
                <span style={{ flex: 1, minWidth: 200 }}>
                  <strong>{result.name}</strong>
                  {result.url === recommendedUrl && (
                    <span style={{ color: 'var(--theme-success-500)', marginLeft: 8 }}>
                      Recommended
                    </span>
                  )}
                  <br />
                  <a href={result.url} target="_blank" rel="noreferrer">
                    {result.brewery ? `${result.brewery} · ` : ''}
                    {result.url.replace('https://untappd.com', '')}
                  </a>
                </span>
                <Button
                  buttonStyle={result.url === recommendedUrl ? 'primary' : 'secondary'}
                  size="medium"
                  margin={false}
                  disabled={saving}
                  onClick={() => void choose(result.url)}
                >
                  Use this
                </Button>
              </li>
            ))}
          </ul>
        )}
        <ErrorText error={error} />
      </Drawer>
    </>
  )
}

type TagOption = { label: string; value: string }

export function TagCell(props: DefaultCellComponentProps) {
  const canUpdate = useCanUpdateBeers()
  const empty = isEmpty(props.cellData)
  const [tags, setTags] = useState<TagOption[] | null>(null)
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
