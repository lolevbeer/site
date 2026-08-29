import * as normalizeBeerReviews from './20260826_210000_normalize_beer_reviews'
import * as normalizeRecurringFood from './20260826_211000_normalize_recurring_food'
import * as addPayloadJobsIndexes from './20260826_212000_add_payload_jobs_indexes'
import * as dropMenuLinesLastCleaned from './20260827_120000_drop_menu_lines_last_cleaned'
import * as scopeRecurringFoodByYear from './20260829_120000_scope_recurring_food_by_year'

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
]
