import { useState, useEffect } from 'react';

interface GeoFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: number;
    Name: string;
    address: string;
    customerType: string;
    uniqueId?: string;
  };
}

interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

interface PayloadDistributor {
  id: string;
  name: string;
  address: string;
  customerType: string;
  region: string;
  // Payload point field can be array or object
  location: [number, number] | { type: 'Point'; coordinates: [number, number] } | null;
}

export function useMapData() {
  const [geoData, setGeoData] = useState<GeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch distributors from Payload API
        const params = new URLSearchParams({
          'where[active][equals]': 'true',
          limit: '1000',
          depth: '0',
        });

        const response = await fetch(`/api/distributors?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch distributors: ${response.status}`);
        }

        const data = await response.json();
        const distributors: PayloadDistributor[] = data.docs || [];

        // Helper to extract coordinates from Payload point field
        const getCoords = (loc: PayloadDistributor['location']): [number, number] | null => {
          if (!loc) return null;
          // Handle GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
          if (typeof loc === 'object' && 'coordinates' in loc && Array.isArray(loc.coordinates)) {
            return loc.coordinates;
          }
          // Handle array format: [lng, lat]
          if (Array.isArray(loc) && loc.length >= 2) {
            return [loc[0], loc[1]];
          }
          return null;
        };

        // Filter out distributors with invalid coordinates and transform to GeoJSON
        const features: GeoFeature[] = distributors
          .map((dist) => ({ dist, coords: getCoords(dist.location) }))
          .filter(({ coords }) => {
            if (!coords) return false;
            const [lng, lat] = coords;
            // Validate coordinate ranges
            return (
              typeof lng === 'number' && typeof lat === 'number' &&
              !isNaN(lng) && !isNaN(lat) &&
              lng >= -180 && lng <= 180 &&
              lat >= -90 && lat <= 90
            );
          })
          .map(({ dist, coords }, index) => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: coords!,
            },
            properties: {
              id: index,
              Name: dist.name,
              address: dist.address,
              customerType: dist.customerType,
              uniqueId: dist.id,
            },
          }));

        setGeoData({
          type: 'FeatureCollection',
          features,
        });
        setLoading(false);
      } catch (err) {
        console.error('Error loading distributor data:', err);
        setError('Failed to load location data');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return { geoData, loading, error };
}
