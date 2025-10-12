import { useState, useEffect, useRef, useCallback } from 'react';

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
    console.error('Geocoding error:', error);
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
  const [searchLocation, setSearchLocation] = useState<Coordinates | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchTerm.trim()) {
      setSearchLocation(null);
      setIsSearching(false);
      return;
    }

    if (detectSearchType(searchTerm)) {
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        const coords = await geocodeLocation(searchTerm);
        if (coords) {
          setSearchLocation(coords);
        }
        setIsSearching(false);
      }, SEARCH_DEBOUNCE);
    } else {
      setSearchLocation(null);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchLocation(null);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    searchLocation,
    isSearching,
    clearSearch
  };
}
