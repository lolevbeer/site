/**
 * Re-runs the Media `sizes` → `variants` rename after the beta.0 build is promoted.
 *
 * Migration 20261013_090000 renames during the production build, but the live
 * canary.37 deployment keeps saving new uploads under `sizes` until promotion.
 * Those docs would then serve their full-size original everywhere. The helper
 * skips docs that are already renamed, so running this again is safe.
 *
 * Run once right after promoting: pnpm payload run scripts/rename-media-sizes.ts
 * (DATABASE_URI → production DB)
 */
import { getPayload } from 'payload'
import { migrateSizesToVariants } from '@payloadcms/db-mongodb/migration-utils'
import config from '@/src/payload.config'

const payload = await getPayload({ config })
await migrateSizesToVariants({ payload })
process.exit(0)
