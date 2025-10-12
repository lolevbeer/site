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

const DATA_SOURCES = {
  PA: '/processed_geo_data.json',
  NY: '/ny_geo_data.json',
} as const;

export function useMapData() {
  const [geoData, setGeoData] = useState<GeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [paResponse, nyResponse] = await Promise.all([
          fetch(DATA_SOURCES.PA),
          fetch(DATA_SOURCES.NY)
        ]);

        const [paData, nyData] = await Promise.all([
          paResponse.json(),
          nyResponse.json()
        ]) as [GeoJSON, GeoJSON];

        // Add unique IDs
        const paFeatures = paData.features.map((feature, index) => ({
          ...feature,
          properties: {
            ...feature.properties,
            uniqueId: `pa_${feature.properties.id}_${index}`
          }
        }));

        const nyFeatures = nyData.features.map((feature, index) => ({
          ...feature,
          properties: {
            ...feature.properties,
            uniqueId: `ny_${feature.properties.id}_${index}`
          }
        }));

        setGeoData({
          type: 'FeatureCollection',
          features: [...paFeatures, ...nyFeatures]
        });
        setLoading(false);
      } catch (err) {
        console.error('Error loading geo data:', err);
        setError('Failed to load location data');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return { geoData, loading, error };
}
