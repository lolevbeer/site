'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { useLocationFilteredData } from '@/lib/hooks/use-location-filtered-data';

interface FoodVendor {
  vendor: string;
  date: string;
  time?: string;
  site?: string;
  day?: string;
}

interface UpcomingFoodProps {
  lawrencevilleFood: FoodVendor[];
  zelienopleFood: FoodVendor[];
}

export function UpcomingFood({ lawrencevilleFood, zelienopleFood }: UpcomingFoodProps) {
  // Filter by location first
  const filteredFood = useLocationFilteredData({
    lawrencevilleData: lawrencevilleFood,
    zelienopleData: zelienopleFood
  });

  // Sort and take first 3
  const upcomingFood = useMemo(() => {
    const foodWithLocation = filteredFood.map((f, index) => {
      // Determine location based on which array the item came from
      const isFromLawrenceville = lawrencevilleFood.includes(f as FoodVendor);
      return {
        ...f,
        location: isFromLawrenceville ? 'lawrenceville' as const : 'zelienople' as const
      };
    });

    foodWithLocation.sort((a, b) => {
      const [yearA, monthA, dayA] = a.date.split('-').map(Number);
      const [yearB, monthB, dayB] = b.date.split('-').map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateA.getTime() - dateB.getTime();
    });

    return foodWithLocation.slice(0, 3);
  }, [filteredFood, lawrencevilleFood]);

  if (upcomingFood.length === 0) {
    return null;
  }

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 flex justify-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Upcoming Food
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 justify-items-center">
          {upcomingFood.map((food, index) => (
            <Card
              key={index}
              className={`overflow-hidden transition-colors border-0 shadow-none bg-transparent dark:bg-transparent ${food.site ? 'cursor-pointer hover:bg-secondary' : ''}`}
              onClick={() => food.site && window.open(food.site, '_blank')}
            >
              <CardContent className="p-6 text-center">
                <h3 className="text-xl font-semibold mb-2">{food.vendor}</h3>
                <div className="space-y-2 text-sm text-muted-foreground flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{(() => {
                      const [year, month, day] = food.date.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      return date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()}</span>
                  </div>
                  {food.time && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{food.time}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{food.location === 'zelienople' ? 'Zelienople' : 'Lawrenceville'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/food">
              View All
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
