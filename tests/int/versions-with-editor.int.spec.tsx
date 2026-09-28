import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Column, DocumentViewServerProps } from 'payload'
import { VersionsWithEditor } from '@/src/components/admin/VersionsWithEditor'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found')
  },
}))

vi.mock('@payloadcms/ui', () => ({
  ListQueryProvider: ({ children }: { children: React.ReactNode }) => children,
  SetDocumentStepNav: () => null,
  SortColumn: ({ Label }: { Label: string }) => Label,
  VersionsCreatedAtCell: ({ rowData }: { rowData: { id: string } }) => (
    <a href={`/versions/${rowData.id}`}>Version</a>
  ),
  VersionsAutosaveCell: () => 'Published',
  VersionsIDCell: ({ id }: { id: string }) => id,
  VersionsViewClient: ({ columns }: { columns: Column[] }) => (
    <table>
      <tbody>
        {columns.map((column) => (
          <tr key={column.accessor}>
            <th>{column.Heading}</th>
            {column.renderedCells.map((cell, index) => (
              <td key={index}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

function fixture(
  slug = 'beers',
  editorIDs: (string | undefined)[] = ['alice', 'bob', undefined, 'deleted', 'alice'],
) {
  const docs = editorIDs.map((updatedBy, index) => ({
    id: `v${index}`,
    updatedAt: '2026-09-27T12:00:00Z',
    version: { updatedBy, _status: 'published', updatedAt: '2026-09-27T12:00:00Z' },
  }))
  const findVersions = vi.fn().mockResolvedValue({ docs, totalDocs: docs.length })
  const find = vi.fn().mockResolvedValue({
    docs: [
      { id: 'alice', name: 'Alice Editor', email: 'alice@example.test' },
      { id: 'bob', email: 'bob@example.test' },
    ],
  })
  const config = {
    slug,
    versions: { drafts: true },
    labels: { plural: slug },
    admin: { useAsTitle: 'name', pagination: { defaultLimit: 10, limits: [10, 100] } },
  }
  const req = {
    user: { id: 'reader' },
    locale: 'en',
    t: (key: string) => key,
    i18n: {},
    server: {
      notFound: () => {
        throw new Error('not found')
      },
    },
    payload: {
      find,
      findVersions,
      collections: { [slug]: { config } },
      config: { routes: { api: '/api' }, loggingLevels: {} },
      logger: { error: vi.fn() },
    },
  }
  const props = {
    hasPublishedDoc: true,
    initPageResult: { collectionConfig: config, docID: 'parent', req },
    routeSegments: ['collections', slug, 'parent', 'versions'],
    searchParams: { limit: '100', page: '2', sort: 'updatedAt' },
  } as unknown as DocumentViewServerProps
  return { props, req, find, findVersions }
}

describe('versions with editor', () => {
  it('shows each version’s editor using one access-controlled lookup', async () => {
    const { props, req, find, findVersions } = fixture()
    const html = renderToStaticMarkup(await VersionsWithEditor(props))
    expect(html).toContain('Last edited by')
    expect(html.match(/Alice Editor/g)).toHaveLength(2)
    expect(html).toContain('bob@example.test')
    expect(html.match(/Unknown/g)).toHaveLength(2)
    expect(html).toContain('/versions/v0')
    expect(find).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        collection: 'users',
        where: { id: { in: ['alice', 'bob', 'deleted'] } },
        select: { name: true, email: true },
        overrideAccess: false,
        req,
      }),
    )
    expect(findVersions).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'beers',
        limit: 100,
        page: 2,
        sort: 'updatedAt',
        where: { and: [{ parent: { equals: 'parent' } }] },
        overrideAccess: false,
        req,
      }),
    )
  })

  it('skips user queries for history without attribution', async () => {
    const { props, find } = fixture('beers', [undefined])
    expect(renderToStaticMarkup(await VersionsWithEditor(props))).toContain('Unknown')
    expect(find).not.toHaveBeenCalled()
  })

  it('does not look up editors when version access is denied', async () => {
    const { props, find, findVersions } = fixture()
    findVersions.mockRejectedValue(new Error('Forbidden'))
    await expect(VersionsWithEditor(props)).rejects.toThrow('not found')
    expect(find).not.toHaveBeenCalled()
  })
})

// VersionsWithEditor mirrors Payload's versions view, and the test above mocks
// @payloadcms/ui, so a Payload upgrade that changes that view would pass
// silently. Fail on any change instead: diff these files against the
// component, re-sync it, then record the new hashes.
it.each([
  ['index.js', 'c023337ae5f171e33f452b9ad6dcbdb3917705ea82297ae4407c26c1e4612e29'],
  ['buildColumns.js', '9a97d1d5b58f841d89d5b015ac0add6eb845774b42239ebfd369f51e426948da'],
])('Payload versions view %s is unchanged since VersionsWithEditor copied it', (file, hash) => {
  const source = readFileSync(`node_modules/@payloadcms/ui/dist/views/Versions/${file}`)
  expect(createHash('sha256').update(source).digest('hex')).toBe(hash)
})
