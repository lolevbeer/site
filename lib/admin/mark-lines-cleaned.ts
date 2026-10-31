/**
 * Client-safe "mark lines cleaned today" request, shared by the menu/location
 * sidebar button and the dashboard. The server supplies today's date (see the
 * Locations `markLinesCleanedToday` hook); this returns the date it saved.
 */

/**
 * Records today's line cleaning for a location as the signed-in user.
 * Returns the saved ISO date; throws on a non-2xx response or when the
 * response carries no saved date.
 */
export async function markLinesCleaned(locationId: string): Promise<string> {
  const response = await fetch(`/api/locations/${encodeURIComponent(locationId)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markLinesCleanedToday: true }),
  })

  if (!response.ok) throw new Error(`Location update failed (${response.status})`)

  const result = (await response.json()) as {
    doc?: { linesLastCleaned?: string | null }
    linesLastCleaned?: string | null
  }
  const savedValue = result.doc?.linesLastCleaned || result.linesLastCleaned
  if (!savedValue) throw new Error('Location response is missing the saved cleaning date')
  return savedValue
}
