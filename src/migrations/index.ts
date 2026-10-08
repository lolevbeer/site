/**
 * Explicit migration registry used by tests that compare against the recovery
 * manifest. `payload migrate` does not read this file. It loads every `.ts`/`.js`
 * sibling except `index.ts`/`index.js` and calls `up()`. Keep non-migration
 * modules out of this directory (the recovery manifest lives in `./recovery`).
 */
import * as normalizeBeerReviews from './20260826_210000_normalize_beer_reviews'
import * as normalizeRecurringFood from './20260826_211000_normalize_recurring_food'
import * as addPayloadJobsIndexes from './20260826_212000_add_payload_jobs_indexes'
import * as dropMenuLinesLastCleaned from './20260827_120000_drop_menu_lines_last_cleaned'
import * as scopeRecurringFoodByYear from './20260829_120000_scope_recurring_food_by_year'
import * as dropGoogleSheetsFields from './20260830_100000_drop_google_sheets_fields'
import * as dropLegacyRecurringFoodSlotIndex from './20260830_143000_drop_legacy_recurring_food_slot_index'
import * as backfillMissingBeerReviews from './20260926_190000_backfill_missing_beer_reviews'
import * as payloadJobsRunnableProcessingUntil from './20260927_020000_payload_jobs_runnable_processing_until'
import * as locationWebsiteMenus from './20260929_120000_location_website_menus'

import * as completeBeerReviews from './20261005_090000_complete_beer_review_backfill'

import * as publicFormIndexes from './20261005_100000_public_form_indexes'

export const migrations = [
  {
    up: normalizeBeerReviews.up,
    down: normalizeBeerReviews.down,
    name: '20260826_210000_normalize_beer_reviews',
  },
  {
    up: normalizeRecurringFood.up,
    down: normalizeRecurringFood.down,
    name: '20260826_211000_normalize_recurring_food',
  },
  {
    up: addPayloadJobsIndexes.up,
    down: addPayloadJobsIndexes.down,
    name: '20260826_212000_add_payload_jobs_indexes',
  },
  {
    up: dropMenuLinesLastCleaned.up,
    down: dropMenuLinesLastCleaned.down,
    name: '20260827_120000_drop_menu_lines_last_cleaned',
  },
  {
    up: scopeRecurringFoodByYear.up,
    down: scopeRecurringFoodByYear.down,
    name: '20260829_120000_scope_recurring_food_by_year',
  },
  {
    up: dropGoogleSheetsFields.up,
    down: dropGoogleSheetsFields.down,
    name: '20260830_100000_drop_google_sheets_fields',
  },
  {
    up: dropLegacyRecurringFoodSlotIndex.up,
    down: dropLegacyRecurringFoodSlotIndex.down,
    name: '20260830_143000_drop_legacy_recurring_food_slot_index',
  },
  {
    up: backfillMissingBeerReviews.up,
    down: backfillMissingBeerReviews.down,
    name: '20260926_190000_backfill_missing_beer_reviews',
  },
  {
    up: payloadJobsRunnableProcessingUntil.up,
    down: payloadJobsRunnableProcessingUntil.down,
    name: '20260927_020000_payload_jobs_runnable_processing_until',
  },
  {
    up: locationWebsiteMenus.up,
    down: locationWebsiteMenus.down,
    name: '20260929_120000_location_website_menus',
  },
  {
    up: completeBeerReviews.up,
    down: completeBeerReviews.down,
    name: '20261005_090000_complete_beer_review_backfill',
  },
  {
    up: publicFormIndexes.up,
    down: publicFormIndexes.down,
    name: '20261005_100000_public_form_indexes',
  },
]
