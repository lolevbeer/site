/**
 * CSV utility functions for parsing and fetching CSV data
 */

import Papa from 'papaparse';

/**
 * Parse CSV string into array of objects using PapaParse
 */
export function parseCSV<T = Record<string, any>>(csvText: string): T[] {
  const result = Papa.parse<T>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: (field) => {
      // Don't auto-convert dates or times to numbers
      return typeof field === 'string' && !field.includes('-') && !field.includes(':');
    },
    transform: (value) => {
      // Handle pipe-separated arrays
      if (typeof value === 'string' && value.includes('|')) {
        return value.split('|').map(v => v.trim());
      }
      return value;
    }
  });

  return result.data;
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

