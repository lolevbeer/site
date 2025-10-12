/**
 * CSV utility functions for parsing and fetching CSV data
 */

/**
 * Parse CSV line handling quoted fields properly
 */
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last field
  result.push(current.trim());

  // Remove surrounding quotes from fields
  return result.map(field => {
    if (field.startsWith('"') && field.endsWith('"')) {
      return field.slice(1, -1);
    }
    return field;
  });
}

/**
 * Parse CSV string into array of objects
 */
export function parseCSV<T = Record<string, any>>(csvText: string): T[] {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];

  // Parse headers
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const data: T[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: any = {};

    headers.forEach((header, index) => {
      let value: any = values[index] || '';

      // Handle special values
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (value === '') value = null;
      else if (!isNaN(Number(value)) && value !== '') {
        // Check if it's a number (but not a date or time string)
        if (!value.includes('-') && !value.includes(':')) {
          value = Number(value);
        }
      }

      // Handle array values (pipe-separated)
      if (typeof value === 'string' && value.includes('|')) {
        value = value.split('|').map(v => v.trim());
      }

      row[header] = value;
    });

    data.push(row as T);
  }

  return data;
}

/**
 * Fetch and parse CSV file from public directory
 */
export async function fetchCSV<T = Record<string, any>>(filename: string): Promise<T[]> {
  try {
    const response = await fetch(`/data/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${filename}`);
    }
    const text = await response.text();
    return parseCSV<T>(text);
  } catch (error) {
    console.error(`Error fetching CSV file ${filename}:`, error);
    return [];
  }
}

/**
 * Format date string to readable format
 */
export function formatDateFromCSV(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format time string from 24h to 12h format
 */
export function formatTimeFromCSV(timeString: string): string {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}