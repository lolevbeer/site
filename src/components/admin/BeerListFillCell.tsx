'use client'

/**
 * Beers list-view cells for the Untappd URL and Tag columns. A filled cell
 * renders Payload's DefaultCell; an empty one, for users who may update beers,
 * offers an inline input so blanks can be filled without opening each beer.
 *
 * Saves PATCH /api/beers/:id, which runs Beers' access rules and hooks (the
 * Untappd URL triggers the rating fetch). Payload merges a PATCH over the
 * latest version, so a beer whose latest version is a draft must save with
 * ?draft=true; otherwise the merge would publish the pending draft.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { DefaultCell, useAuth } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'

type Field = 'untappd' | 'tag'

function useSaveBeerField(rowData: DefaultCellComponentProps['rowData'], field: Field) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(value: string) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
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

export function UntappdCell(props: DefaultCellComponentProps) {
  const canUpdate = useCanUpdateBeers()
  const [value, setValue] = useState('')
  const { save, saving, error } = useSaveBeerField(props.rowData, 'untappd')

  if (!isEmpty(props.cellData)) return <DefaultCell {...props} />
  if (!canUpdate) return null

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const url = value.trim()
    if (url) void save(url)
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      <input
        aria-label="Untappd URL"
        placeholder="/b/lolev-beer-…/123456"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={saving}
      />
      <button type="submit" disabled={saving || !value.trim()}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <ErrorText error={error} />
    </form>
  )
}

type TagOption = { id: string; name: string }

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
      .then((res) => res.json() as Promise<{ docs: TagOption[] }>)
      .then((body) => setTags(body.docs))
      .catch(() => {})
    return () => controller.abort()
  }, [empty, canUpdate])

  if (!empty) return <DefaultCell {...props} />
  if (!canUpdate) return null

  return (
    <span>
      <select
        aria-label="Tag"
        defaultValue=""
        disabled={saving || !tags}
        onChange={(event) => event.target.value && void save(event.target.value)}
      >
        <option value="">{tags ? 'Set tag…' : 'Loading…'}</option>
        {tags?.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
      <ErrorText error={error} />
    </span>
  )
}
