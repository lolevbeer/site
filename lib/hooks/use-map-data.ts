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
  location: [number, number]; // [longitude, latitude]
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

        // Transform Payload distributors to GeoJSON format
        const features: GeoFeature[] = distributors.map((dist, index) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: dist.location, // Already [longitude, latitude]
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
