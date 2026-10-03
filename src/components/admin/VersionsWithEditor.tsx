import React from 'react'
import { notFound } from 'next/navigation'
import type { Column, DocumentViewServerProps, SelectType } from 'payload'
import { formatAdminURL, isNumber } from 'payload/shared'
import {
  ListQueryProvider,
  SetDocumentStepNav,
  SortColumn,
  VersionsAutosaveCell,
  VersionsCreatedAtCell,
  VersionsIDCell,
  VersionsViewClient,
} from '@payloadcms/ui'
import { fetchLatestVersion, fetchVersions } from '@payloadcms/ui/views/Versions/fetchVersions'

import { editorNames } from './editor-names'

type VersionData = {
  _status: 'draft' | 'published'
  updatedAt: string
  updatedBy?: string | null
}

// Versions list for Beers and Menus. Payload 4's version columns are fixed (its
// only hook, CreatedAtCellOverride, swaps one cell), so this mirrors its view
// (@payloadcms/ui/dist/views/Versions, 4.0.0-canary.37) plus a "Last edited by"
// column read from each version's `updatedBy`. Re-check it on Payload upgrades.
export async function VersionsWithEditor({
  hasPublishedDoc,
  initPageResult: { collectionConfig, docID, req },
  routeSegments,
  searchParams = {},
}: DocumentViewServerProps) {
  if (!collectionConfig || !docID) return notFound()

  const { slug, admin } = collectionConfig
  const { i18n, payload, t } = req
  const isTrashed = routeSegments[2] === 'trash'
  const limit = isNumber(searchParams.limit)
    ? Number(searchParams.limit)
    : (admin.pagination?.defaultLimit ?? 10)
  const query = {
    collectionSlug: slug,
    parentID: docID,
    depth: 0,
    overrideAccess: false,
    req,
  }
  const data = await fetchVersions<VersionData>({
    ...query,
    limit,
    page: searchParams.page ? Number(searchParams.page) : undefined,
    sort: searchParams.sort,
  })
  if (!data) return notFound()

  // The status column only compares IDs and dates, as in Payload's view.
  const latestSelect: SelectType = {
    id: true,
    updatedAt: true,
    version: { _status: true, updatedAt: true },
  }

  const [published, draft, editorNamesById] = await Promise.all([
    hasPublishedDoc
      ? fetchLatestVersion<VersionData>({ ...query, select: latestSelect, status: 'published' })
      : null,
    fetchLatestVersion<VersionData>({ ...query, select: latestSelect, status: 'draft' }),
    editorNames(
      req,
      data.docs.map(({ version }) => version.updatedBy),
    ),
  ])
  const columns: Column[] = [
    {
      accessor: 'updatedAt',
      active: true,
      field: { name: '', type: 'date' },
      Heading: <SortColumn Label={t('general:updatedAt')} name="updatedAt" />,
      isLinkedColumn: true,
      renderedCells: data.docs.map((doc) => (
        <VersionsCreatedAtCell
          key={doc.id}
          collectionSlug={slug}
          docID={docID}
          isTrashed={isTrashed}
          rowData={doc}
        />
      )),
    },
    {
      accessor: '_status',
      active: true,
      field: { name: '', type: 'checkbox' },
      Heading: <SortColumn Label={t('version:status')} name="status" />,
      renderedCells: data.docs.map((doc) => (
        <VersionsAutosaveCell
          key={doc.id}
          currentlyPublishedVersion={published ?? undefined}
          latestDraftVersion={draft ?? undefined}
          rowData={doc}
        />
      )),
    },
    {
      accessor: 'version.updatedBy',
      active: true,
      field: { name: 'updatedBy', type: 'text' },
      Heading: 'Last edited by',
      renderedCells: data.docs.map(
        ({ version }) => editorNamesById.get(version.updatedBy ?? '') || 'Unknown',
      ),
    },
    {
      accessor: 'id',
      active: true,
      field: { name: '', type: 'text' },
      Heading: <SortColumn Label={t('version:versionID')} name="id" />,
      renderedCells: data.docs.map((doc) => <VersionsIDCell key={doc.id} id={doc.id} />),
    },
  ]

  return (
    <>
      <SetDocumentStepNav
        collectionSlug={slug}
        id={docID}
        isTrashed={isTrashed}
        pluralLabel={
          typeof collectionConfig.labels.plural === 'function'
            ? collectionConfig.labels.plural({ i18n, t })
            : collectionConfig.labels.plural
        }
        useAsTitle={admin.useAsTitle}
        view={t('version:versions')}
      />
      <main className="versions">
        <div className="versions__wrap">
          <ListQueryProvider
            data={data}
            modifySearchParams
            query={{ limit, sort: searchParams.sort }}
          >
            <VersionsViewClient
              baseClass="versions"
              columns={columns}
              fetchURL={formatAdminURL({
                apiRoute: payload.config.routes.api,
                path: `/${slug}/versions`,
              })}
              paginationLimits={admin.pagination?.limits}
            />
          </ListQueryProvider>
        </div>
      </main>
    </>
  )
}
