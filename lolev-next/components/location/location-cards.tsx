'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Phone } from 'lucide-react';
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

export function LocationCards() {
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

  const getFullSchedule = (locationHours: HoursData[]) => {
    if (!locationHours || locationHours.length === 0) return [];

    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return locationHours
      .sort((a, b) => {
        const aIndex = dayOrder.indexOf(a.name);
        const bIndex = dayOrder.indexOf(b.name);
        return aIndex - bIndex;
      });
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
        <Link key={id} href={data.mapUrl || '#'} target="_blank" rel="noopener noreferrer" className="group flex">
          <Card className="overflow-hidden flex flex-col border-0 hover:shadow-lg transition-shadow cursor-pointer w-full">
            <div className="aspect-video relative">
            {image ? (
              <>
                <Image
                  src={image}
                  alt={`${displayName} location`}
                  fill
                  className="object-cover"
                  priority={id === Location.LAWRENCEVILLE}
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="text-center text-white">
                    <h3 className="text-2xl font-bold mb-2 drop-shadow-lg">{displayName}</h3>
                    {loading ? (
                      <p className="text-lg drop-shadow-md">Loading hours...</p>
                    ) : (
                      <p className="text-lg font-medium drop-shadow-md">
                        Today: {hoursData && getTodayHours(hoursData[id])}
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className={`h-full bg-gradient-to-br ${gradient}`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-800">
                    <h3 className="text-2xl font-bold mb-2">{displayName}</h3>
                    {loading ? (
                      <p className="text-lg">Loading hours...</p>
                    ) : (
                      <p className="text-lg font-medium">
                        Today: {hoursData && getTodayHours(hoursData[id])}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <CardContent className="p-6 flex flex-col flex-grow">
            <div className="flex-grow flex flex-col items-center justify-center text-center">
              <h3 className="text-xl font-semibold mb-4">{displayName} Taproom</h3>
              <div className="space-y-3 text-muted-foreground">
                {/* Address */}
                <div className="flex items-start gap-2 justify-center">
                  <MapPin className="h-5 w-5 mt-0.5 text-primary" />
                  <div>
                    <p>{data.address}</p>
                    <p className="text-sm">{data.city}, {data.state} {data.zipCode}</p>
                  </div>
                </div>

                {/* Phone */}
                {data.phone && (
                  <div className="flex items-start gap-2 justify-center">
                    <Phone className="h-5 w-5 mt-0.5 text-primary" />
                    <div>
                      {data.phone}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        </Link>
      ))}
    </div>
  );
}