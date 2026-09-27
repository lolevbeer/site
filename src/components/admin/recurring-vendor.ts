/**
 * The recurring food vendor scheduled at a location on a date, for the Event
 * and Food date warnings. The weekday, week of the month, schedule year, and
 * exclusion key all come from the editor's local calendar date, so an evening
 * date can't be looked up under the next day's UTC key.
 */
import { getFoodVendor, getRecurringFoodData } from '@/src/actions/admin-data'
import { toDateKey } from '@/lib/utils/food-dates'
import {
  recurringDayName,
  recurringOccurrences,
  recurringWeekOccurrence,
} from '@/src/utils/recurring-food'

/** The vendor's name, or null when nothing recurring is scheduled that day. */
export async function getRecurringVendorName(
  date: Date,
  locationId: string,
): Promise<string | null> {
  const weekKey = recurringOccurrences[recurringWeekOccurrence(date) - 1]
  const data = await getRecurringFoodData(date.getFullYear())
  const vendorId = data.schedules?.[locationId]?.[recurringDayName(date)]?.[weekKey]
  if (!vendorId || data.exclusions?.[locationId]?.includes(toDateKey(date))) return null

  const vendor = await getFoodVendor(vendorId)
  return vendor?.name || 'Unknown vendor'
}
