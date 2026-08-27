import * as normalizeBeerReviews from './20260826_210000_normalize_beer_reviews'
import * as normalizeRecurringFood from './20260826_211000_normalize_recurring_food'
import * as addPayloadJobsIndexes from './20260826_212000_add_payload_jobs_indexes'

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
]
