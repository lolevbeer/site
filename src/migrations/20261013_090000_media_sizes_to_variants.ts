/**
 * Payload 4 beta.0 stores a Media doc's generated images under `variants`
 * (formerly `sizes`). Renames the stored field with Payload's predefined
 * helper, which `$rename`s each doc, re-keys indexes, skips docs already
 * renamed, and refuses to run if a collection has data under both keys.
 */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'
import { migrateSizesToVariants } from '@payloadcms/db-mongodb/migration-utils'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await migrateSizesToVariants({ payload, req })
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await migrateSizesToVariants({ direction: 'down', payload, req })
}
