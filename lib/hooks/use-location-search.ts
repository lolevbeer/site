import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
const SEARCH_DEBOUNCE = 800;

interface Coordinates {
  latitude: number;
  longitude: number;
}

const geocodeLocation = async (query: string): Promise<Coordinates | null> => {
  if (!MAPBOX_TOKEN || !query.trim()) return null;

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `access_token=${MAPBOX_TOKEN}&country=US&limit=1`
    );

    if (!response.ok) return null;
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }
  } catch (error) {
    logger.error('Geocoding error:', error);
  }
  return null;
};

const detectSearchType = (searchTerm: string): boolean => {
  const isZipcode = /^\d{5}$/.test(searchTerm.trim());
  const hasLocationIndicators = /\b(street|st|ave|avenue|rd|road|blvd|boulevard|city|state|[A-Z]{2})\b/i.test(searchTerm);
  const hasComma = searchTerm.includes(',');
  const hasMultipleWords = searchTerm.trim().split(' ').length >= 2;

  return isZipcode || hasLocationIndicators || hasComma || hasMultipleWords;
};

export function useLocationSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  // The geocode result is stored with the term it was resolved for. Everything
  // exposed below is then derived, so a term that is cleared or is not
  // geocodable simply stops matching — no effect has to clear state, which is
  // what react-hooks/set-state-in-effect flags.
  const [geocoded, setGeocoded] = useState<{ term: string; coords: Coordinates } | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const shouldGeocode = searchTerm.trim() !== '' && detectSearchType(searchTerm);
  const searchLocation = shouldGeocode && geocoded?.term === searchTerm ? geocoded.coords : null;
  const isSearching = shouldGeocode && searching;

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!shouldGeocode) return;

    const term = searchTerm;
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      const coords = await geocodeLocation(term);
      if (coords) {
        setGeocoded({ term, coords });
      }
      setSearching(false);
    }, SEARCH_DEBOUNCE);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, shouldGeocode]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setGeocoded(null);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    searchLocation,
    isSearching,
    clearSearch
  };
}
