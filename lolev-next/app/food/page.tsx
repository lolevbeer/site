'use client';

/**
 * Food Page
 * Displays food truck schedule and vendor information with location awareness
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Metadata } from 'next';
import {
  FoodVendorSchedule,
  FoodVendor,
  FoodSchedule,
  FoodVendorDetailed,
  FoodVendorType,
  CuisineType,
  DayOfWeek,
  DietaryOption
} from '@/lib/types/food';
import { loadFoodFromCSV, getTodaysFoodTrucks, getUpcomingFoodTrucks } from '@/lib/utils/food';
import { getTodayEST, isTodayEST, getDayOfWeekEST } from '@/lib/utils/date';
import { Location } from '@/lib/types/location';
import { FoodSchedule as FoodScheduleComponent, CompactFoodSchedule } from '@/components/food/food-schedule';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, Calendar, Clock, MapPin, Star, Users, Utensils, Mail, Phone, Sparkles, ExternalLink, Instagram, Facebook } from 'lucide-react';

// Note: metadata export not supported in Client Components
// export const metadata: Metadata = {
//   title: 'Food Trucks | Love of Lev Brewery',
//   description: 'Discover amazing food trucks at Love of Lev Brewery. Check our weekly schedule for diverse cuisine options at our Lawrenceville and Zelienople locations.',
//   keywords: ['food trucks', 'brewery food', 'Pittsburgh food trucks', 'food schedule', 'mobile food'],
//   openGraph: {
//     title: 'Food Trucks | Love of Lev Brewery',
//     description: 'Discover amazing food trucks at Love of Lev Brewery. Check our weekly schedule for diverse cuisine options.',
//     type: 'website',
//   }
// };

export default function FoodPage() {
  const [vendors, setVendors] = useState<FoodVendor[]>([]);
  const [schedules, setSchedules] = useState<FoodSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [todaysSchedules, setTodaysSchedules] = useState<FoodVendorSchedule[]>([]);

  useEffect(() => {
    const loadFood = async () => {
      try {
        const { vendors: csvVendors, schedules: csvSchedules } = await loadFoodFromCSV();
        setVendors(csvVendors);
        setSchedules(csvSchedules);

        // Convert schedules to FoodVendorSchedule format for today's trucks
        const todayStr = getTodayEST();
        const todaysData = csvSchedules
          .filter(s => isTodayEST(s.date))
          .map(s => {
            const vendor = csvVendors.find(v => v.id === s.vendorId);
            const dateStr = s.date.split('T')[0];
            const [year, month, day] = dateStr.split('-').map(Number);
            // Create date in local timezone (treating it as EST)
            const date = new Date(year, month - 1, day, 12, 0, 0);
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

            return {
              vendor: vendor?.name || '',
              date: dateStr,
              time: `${s.startTime}-${s.endTime}`,
              site: vendor?.website,
              day: DayOfWeek[dayOfWeek.toUpperCase() as keyof typeof DayOfWeek],
              start: s.startTime,
              finish: s.endTime,
              dayNumber: date.getDay(),
              location: s.location,
              specialEvent: false
            } as FoodVendorSchedule;
          });

        setTodaysSchedules(todaysData);
      } catch (error) {
        console.error('Error loading food data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFood();
  }, []);

  // Convert schedules to FoodVendorSchedule format
  const vendorSchedules: FoodVendorSchedule[] = useMemo(() => {
    return schedules.map(schedule => {
      const vendor = vendors.find(v => v.id === schedule.vendorId);
      const dateStr = schedule.date.split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date in local timezone (treating it as EST)
      const date = new Date(year, month - 1, day, 12, 0, 0);
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

      return {
        vendor: vendor?.name || 'Unknown Vendor',
        date: dateStr,
        time: `${schedule.startTime}-${schedule.endTime}`,
        site: vendor?.website,
        day: DayOfWeek[dayOfWeek.toUpperCase() as keyof typeof DayOfWeek],
        start: schedule.startTime,
        finish: schedule.endTime,
        dayNumber: date.getDay(),
        location: schedule.location,
        specialEvent: false,
        notes: schedule.notes
      } as FoodVendorSchedule;
    });
  }, [schedules, vendors]);

  // Convert vendors to FoodVendorDetailed format
  const detailedVendors: FoodVendorDetailed[] = useMemo(() => {
    return vendors.map(vendor => {
      // Map cuisine string to CuisineType enum
      const getCuisineType = (cuisine: string): CuisineType => {
        const c = cuisine?.toLowerCase() || '';
        if (c.includes('mexican') || c.includes('taco')) return CuisineType.MEXICAN;
        if (c.includes('pizza') || c.includes('italian')) return CuisineType.PIZZA;
        if (c.includes('bbq')) return CuisineType.BBQ;
        if (c.includes('american') || c.includes('deli')) return CuisineType.AMERICAN;
        if (c.includes('asian') || c.includes('korean')) return CuisineType.ASIAN;
        if (c.includes('sandwich')) return CuisineType.SANDWICHES;
        if (c.includes('haitian') || c.includes('caribbean')) return CuisineType.CARIBBEAN;
        if (c.includes('latin')) return CuisineType.LATIN;
        if (c.includes('greek') || c.includes('gyro')) return CuisineType.GREEK;
        return CuisineType.STREET_FOOD;
      };

      return {
        name: vendor.name,
        type: FoodVendorType.FOOD_TRUCK,
        cuisineTypes: [getCuisineType(vendor.cuisine)],
        description: vendor.description || `Enjoy delicious food from ${vendor.name}`,
        website: vendor.website,
        active: vendor.isActive,
        popularItems: vendor.popular || [],
        priceRange: 2,
        dietaryOptions: []
      };
    });
  }, [vendors]);


  const handleVendorClick = (schedule: FoodVendorSchedule) => {
    // Handle vendor details view
    console.log('Vendor clicked:', schedule);
  };

  const getLinkIcon = (url: string | undefined) => {
    if (!url) return ExternalLink;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) {
      return Instagram;
    }
    if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) {
      return Facebook;
    }
    return ExternalLink;
  };


  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Food Trucks at Love of Lev
        </h1>
        <p className="text-muted-foreground">
          Delicious food meets craft beer! Check out our rotating selection of
          local food trucks bringing amazing cuisine to both our locations.
        </p>
      </div>

      {/* Today's Trucks */}
      {todaysSchedules.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Today
            </h2>
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {todaysSchedules.map((schedule, index) => {
              const vendor = detailedVendors.find(v => v.name === schedule.vendor);
              return (
                <Card
                  key={index}
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer"
                  onClick={() => schedule.site && window.open(schedule.site, '_blank')}
                >
                  <CardHeader>
                    <div className="text-center">
                      <CardTitle className="text-xl">{schedule.vendor}</CardTitle>
                      <div className="mt-3 space-y-1">
                        <div className="text-sm text-muted-foreground">
                          {schedule.time}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {schedule.location === Location.LAWRENCEVILLE ? 'Lawrenceville' : 'Zelienople'}
                        </div>
                      </div>
                      {schedule.site && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity mx-auto mt-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(schedule.site, '_blank');
                          }}
                        >
                          {React.createElement(getLinkIcon(schedule.site), {
                            className: "h-4 w-4"
                          })}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  {(vendor?.cuisineTypes || vendor?.description || schedule.specialEvent) && (
                    <CardContent className="text-center">
                      {vendor?.cuisineTypes && vendor.cuisineTypes.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 mb-3">
                          {vendor.cuisineTypes.filter(c => c).map((cuisine, idx) => (
                            <Badge
                              key={`cuisine-${idx}`}
                              variant="secondary"
                            >
                              {String(cuisine).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {vendor?.description && (
                        <p className="text-sm text-muted-foreground">
                          {vendor.description}
                        </p>
                      )}
                      {schedule.specialEvent && schedule.notes && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-medium flex items-center justify-center gap-2">
                            <Sparkles className="h-4 w-4 text-yellow-500" />
                            {schedule.notes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Food Schedule Section */}
      <section className="space-y-8 mt-12">
        <FoodScheduleComponent
          schedules={vendorSchedules}
          onVendorClick={handleVendorClick}
          showLocationFilter={true}
          variant="weekly"
          loading={loading}
        />
      </section>


      {/* Food Truck Info */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Why Food Trucks?</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Support Local Business
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                We partner with local food entrepreneurs to bring you diverse, high-quality meals.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Diverse Options
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                From BBQ to Korean fusion, there's something delicious for every taste preference.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5" />
                Perfect Pairing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Great food plus craft beer equals the perfect dining experience.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact for Food Trucks */}
      <section className="text-center space-y-4 pt-8 border-t border-border">
        <h2 className="text-xl font-semibold text-foreground">Interested in Joining Our Food Truck Program?</h2>
        <p className="text-muted-foreground">
          We're always looking for amazing food trucks to partner with us. Contact us to learn more about opportunities.
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" asChild>
            <a href="mailto:info@lolev.beer" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              info@lolev.beer
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="tel:4123368965" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              (412) 336-8965
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}