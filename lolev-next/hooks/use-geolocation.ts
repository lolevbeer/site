import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const MAP_CONFIG = {
  GEO_TIMEOUT: 5000,
  GEO_MAX_AGE: 60000,
} as const;

interface Coordinates {
  latitude: number;
  longitude: number;
}

export function useGeolocation() {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  const getUserLocation = useCallback((
    onSuccess?: (coords: Coordinates) => void,
    onError?: () => void
  ) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      onError?.();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coords = { latitude, longitude };
        setUserLocation(coords);
        onSuccess?.(coords);
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Please enable location access',
          2: 'Location unavailable',
          3: 'Location request timed out'
        };
        toast.error(messages[error.code] || 'Unable to get location');
        onError?.();
      },
      {
        enableHighAccuracy: false,
        timeout: MAP_CONFIG.GEO_TIMEOUT,
        maximumAge: MAP_CONFIG.GEO_MAX_AGE
      }
    );
  }, []);

  return { userLocation, getUserLocation };
}
