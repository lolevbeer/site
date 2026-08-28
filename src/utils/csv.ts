/**
 * Shared CSV parsing primitives for the data importers.
 *
 * Both CSV entry points — the Lake Beverage file upload
 * (`src/endpoints/import-lake-beverage-csv.ts`) and the Google Sheets sync
 * (`src/endpoints/sync-google-sheets.ts`) — used to carry their own copy of the
 * quote-aware line splitter. They live here so a fix to the quoting rules
 * applies to every import path at once.
 */

/**
 * Split a single CSV line into its fields.
 *
 * Handles double-quoted fields (commas inside quotes are literal) and the CSV
 * escape for a literal quote (`""` inside a quoted field).
 *
 * Fields are returned verbatim, without trimming — every caller trims the
 * values it actually reads, so surrounding whitespace is theirs to handle.
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
