'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Beer } from 'lucide-react';
import { Location } from '@/lib/types/location';
import { LOCATIONS_DATA } from '@/lib/config/locations';
import { fetchCSV } from '@/lib/utils/csv';

interface HoursData {
  name: string;
  hours: string;
  'day-code': string;
}

interface LocationHoursState {
  [Location.LAWRENCEVILLE]: HoursData[];
  [Location.ZELIENOPLE]: HoursData[];
}

interface LocationCardsProps {
  beerCount?: { lawrenceville: number; zelienople: number };
}

export function LocationCards({ beerCount }: LocationCardsProps = {}) {
  const [hoursData, setHoursData] = useState<LocationHoursState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHours = async () => {
      try {
        const [lawrencevilleHours, zelienopleHours] = await Promise.all([
          fetchCSV<HoursData>('lawrenceville-hours.csv'),
          fetchCSV<HoursData>('zelienople-hours.csv')
        ]);

        setHoursData({
          [Location.LAWRENCEVILLE]: lawrencevilleHours,
          [Location.ZELIENOPLE]: zelienopleHours
        });
      } catch (error) {
        console.error('Error loading hours:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHours();
  }, []);

  const getTodayHours = (locationHours: HoursData[]) => {
    if (!locationHours || locationHours.length === 0) return 'Hours not available';

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = days[new Date().getDay()];
    const todayData = locationHours.find(h => h.name === today);

    return todayData?.hours || 'Closed';
  };


  const locations = [
    {
      id: Location.LAWRENCEVILLE,
      data: LOCATIONS_DATA[Location.LAWRENCEVILLE],
      gradient: 'from-amber-200 to-orange-300',
      displayName: 'Lawrenceville',
      image: '/images/Lawrenceville-front.jpg'
    },
    {
      id: Location.ZELIENOPLE,
      data: LOCATIONS_DATA[Location.ZELIENOPLE],
      gradient: 'from-green-200 to-blue-300',
      displayName: 'Zelienople',
      image: '/images/Zelienople-interior.jpg'
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
      {locations.map(({ id, data, gradient, displayName, image }) => (
        <div key={id} className="flex flex-col relative pb-16">
          {/* Location Image */}
          <div className="aspect-video relative mb-6">
            {image ? (
              <Image
                src={image}
                alt={`${displayName} location`}
                fill
                className="object-cover rounded-lg"
                priority={id === Location.LAWRENCEVILLE}
                fetchPriority={id === Location.LAWRENCEVILLE ? "high" : "low"}
                quality={85}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className={`h-full bg-gradient-to-br ${gradient} rounded-lg`} />
            )}
          </div>

          {/* Location Info */}
          <div className="flex flex-col items-center text-center space-y-4">
            <h3 className="text-2xl font-bold">{displayName}</h3>

            {/* Today's Hours */}
            <div className="text-muted-foreground">
              {loading ? (
                <p>Loading hours...</p>
              ) : (
                <p className="font-medium">
                  Today: {hoursData && getTodayHours(hoursData[id])}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="text-muted-foreground">
              <p>{data.address}</p>
              <p>{data.city}, {data.state} {data.zipCode}</p>
            </div>

            {/* Phone */}
            {data.phone && (
              <div className="text-muted-foreground">
                <a href={`tel:${data.phone}`} className="hover:underline">
                  {data.phone}
                </a>
              </div>
            )}
          </div>

          {/* Map Link Button - Positioned absolutely at bottom */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            <Button asChild variant="outline" size="default" className="w-full max-w-xs">
              <Link href={data.mapUrl || '#'} target="_blank" rel="noopener noreferrer">
                Get Directions
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}