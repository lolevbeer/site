'use client';

/**
 * Food Page
 * Displays food truck schedule and vendor information with location awareness
 */

import React, { useEffect, useState } from 'react';
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
import { loadFoodFromCSV } from '@/lib/utils/food';
import { Location } from '@/lib/types/location';
import { FoodSchedule as FoodScheduleComponent, CompactFoodSchedule } from '@/components/food/food-schedule';
import { VendorCard } from '@/components/food/vendor-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, Calendar, Clock, MapPin, Star, Users, Utensils } from 'lucide-react';

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

  useEffect(() => {
    const loadFood = async () => {
      try {
        const { vendors: csvVendors, schedules: csvSchedules } = await loadFoodFromCSV();
        setVendors(csvVendors);
        setSchedules(csvSchedules);
      } catch (error) {
        console.error('Error loading food data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFood();
  }, []);

  // Temporary mock schedules for UI until data loads
  const mockSchedules: FoodVendorSchedule[] = [
  {
    vendor: 'Smoky Joe\'s BBQ',
    date: new Date().toISOString().split('T')[0],
    time: '4:00-9:00pm',
    site: 'https://instagram.com/smokyjoesBBQ',
    day: DayOfWeek.MONDAY,
    start: '16:00',
    finish: '21:00',
    dayNumber: 1,
    location: Location.LAWRENCEVILLE,
    specialEvent: false
  },
  {
    vendor: 'Taco Libre',
    date: new Date().toISOString().split('T')[0],
    time: '5:00-10:00pm',
    site: 'https://facebook.com/TacoLibrePGH',
    day: DayOfWeek.MONDAY,
    start: '17:00',
    finish: '22:00',
    dayNumber: 1,
    location: Location.ZELIENOPLE,
    specialEvent: false
  },
  {
    vendor: 'Pizza on Wheels',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    time: '3:00-8:00pm',
    day: DayOfWeek.TUESDAY,
    start: '15:00',
    finish: '20:00',
    dayNumber: 2,
    location: Location.LAWRENCEVILLE,
    specialEvent: false
  },
  {
    vendor: 'Seoul Kitchen',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    time: '4:00-9:00pm',
    site: 'https://instagram.com/seoulkitchentruck',
    day: DayOfWeek.TUESDAY,
    start: '16:00',
    finish: '21:00',
    dayNumber: 2,
    location: Location.ZELIENOPLE,
    specialEvent: false
  },
  {
    vendor: 'Burger Brothers',
    date: new Date(Date.now() + 172800000).toISOString().split('T')[0], // Day after tomorrow
    time: '5:00-10:00pm',
    day: DayOfWeek.WEDNESDAY,
    start: '17:00',
    finish: '22:00',
    dayNumber: 3,
    location: Location.LAWRENCEVILLE,
    specialEvent: true,
    notes: 'Special brewery burger collaboration!'
  }
];

const mockVendors: FoodVendorDetailed[] = [
  {
    name: 'Smoky Joe\'s BBQ',
    type: FoodVendorType.FOOD_TRUCK,
    cuisineTypes: [CuisineType.BBQ, CuisineType.SOUTHERN],
    description: 'Authentic slow-smoked BBQ with all the fixings. Family recipes passed down for generations.',
    website: 'https://smokyjoesBBQ.com',
    instagram: '@smokyjoesBBQ',
    active: true,
    rating: 4.8,
    popularItems: ['Pulled Pork', 'Brisket', 'Mac & Cheese'],
    priceRange: 2,
    dietaryOptions: [DietaryOption.GLUTEN_FREE]
  },
  {
    name: 'Taco Libre',
    type: FoodVendorType.FOOD_TRUCK,
    cuisineTypes: [CuisineType.MEXICAN, CuisineType.FUSION],
    description: 'Fresh Mexican street food with a modern twist. Made-to-order tacos and burritos.',
    facebook: 'https://facebook.com/TacoLibrePGH',
    instagram: '@tacolibrePGH',
    active: true,
    rating: 4.6,
    popularItems: ['Fish Tacos', 'Carnitas Burrito', 'Elote'],
    priceRange: 2,
    dietaryOptions: [DietaryOption.VEGETARIAN, DietaryOption.VEGAN, DietaryOption.GLUTEN_FREE]
  },
  {
    name: 'Pizza on Wheels',
    type: FoodVendorType.FOOD_TRUCK,
    cuisineTypes: [CuisineType.PIZZA, CuisineType.ITALIAN],
    description: 'Wood-fired pizza made fresh in our mobile oven. Authentic Italian recipes.',
    active: true,
    rating: 4.7,
    popularItems: ['Margherita', 'Pepperoni', 'Veggie Supreme'],
    priceRange: 2,
    dietaryOptions: [DietaryOption.VEGETARIAN, DietaryOption.VEGAN]
  },
  {
    name: 'Seoul Kitchen',
    type: FoodVendorType.FOOD_TRUCK,
    cuisineTypes: [CuisineType.KOREAN, CuisineType.ASIAN],
    description: 'Korean comfort food and Korean-fusion dishes. Fresh ingredients and bold flavors.',
    instagram: '@seoulkitchentruck',
    active: true,
    rating: 4.9,
    popularItems: ['Bulgogi Bowl', 'Korean Fried Chicken', 'Kimchi Fries'],
    priceRange: 2,
    dietaryOptions: [DietaryOption.GLUTEN_FREE, DietaryOption.DAIRY_FREE]
  },
  {
    name: 'Burger Brothers',
    type: FoodVendorType.FOOD_TRUCK,
    cuisineTypes: [CuisineType.AMERICAN, CuisineType.COMFORT_FOOD],
    description: 'Gourmet burgers and craft fries. Local beef and creative toppings.',
    active: true,
    rating: 4.5,
    popularItems: ['Brewery Burger', 'Truffle Fries', 'Chicken Sandwich'],
    priceRange: 3,
    dietaryOptions: [DietaryOption.VEGETARIAN]
  }
];

  const handleVendorClick = (schedule: FoodVendorSchedule) => {
    // Handle vendor details view
    console.log('Vendor clicked:', schedule);
  };

  const todaysSchedule = mockSchedules.filter(schedule =>
    schedule.date === new Date().toISOString().split('T')[0]
  );

  const featuredVendors = mockVendors.filter(vendor => vendor.rating && vendor.rating >= 4.7);

  const cuisineStats = mockVendors.reduce((acc, vendor) => {
    vendor.cuisineTypes.forEach(cuisine => {
      acc[cuisine] = (acc[cuisine] || 0) + 1;
    });
    return acc;
  }, {} as Record<CuisineType, number>);

  const topCuisines = Object.entries(cuisineStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Food Trucks at Love of Lev
        </h1>
        <p>
          Delicious food meets craft beer! Check out our rotating selection of
          local food trucks bringing amazing cuisine to both our locations.
        </p>
      </div>

      {/* Today's Trucks */}
      {todaysSchedule.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-green-600" />
            Today's Food Trucks
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {todaysSchedule.map((schedule, index) => {
              const vendor = mockVendors.find(v => v.name === schedule.vendor);
              return (
                <Card key={index} className="p-4 border-green-200 bg-green-50">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-green-900">{schedule.vendor}</h3>
                        <div className="flex items-center gap-4 text-sm text-green-700">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {schedule.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {schedule.location === Location.LAWRENCEVILLE ? 'Lawrenceville' : 'Zelienople'}
                          </span>
                        </div>
                      </div>
                      {vendor?.rating && (
                        <div className="flex items-center gap-1 text-green-700">
                          <Star className="h-3 w-3 fill-current" />
                          <span className="text-sm font-medium">{vendor.rating}</span>
                        </div>
                      )}
                    </div>
                    {vendor?.cuisineTypes && (
                      <div className="flex flex-wrap gap-1">
                        {vendor.cuisineTypes.map(cuisine => (
                          <Badge key={cuisine} variant="outline" className="text-xs border-green-300 text-green-700">
                            {cuisine.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {schedule.specialEvent && schedule.notes && (
                      <p className="text-sm text-green-700 font-medium">
                        🌟 {schedule.notes}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Food Schedule Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Food Truck Schedule</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Updated weekly</span>
          </div>
        </div>

        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="vendors" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Vendors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-0">
            <FoodScheduleComponent
              schedules={mockSchedules}
              onVendorClick={handleVendorClick}
              showLocationFilter={true}
              variant="weekly"
            />
          </TabsContent>

          <TabsContent value="vendors" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {mockVendors.map((vendor, index) => (
                <VendorCard
                  key={index}
                  vendor={vendor}
                  variant="default"
                  onVendorClick={() => console.log('Vendor clicked:', vendor)}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Featured Vendors */}
      {featuredVendors.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-600" />
            Top Rated Vendors
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredVendors.map((vendor, index) => (
              <VendorCard
                key={index}
                vendor={vendor}
                variant="detailed"
                onVendorClick={() => console.log('Featured vendor clicked:', vendor)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Cuisine Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Popular Cuisines</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {topCuisines.map(([cuisine, count]) => (
            <Card key={cuisine} className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {cuisine.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <Badge variant="secondary">{count} vendor{count !== 1 ? 's' : ''}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Food Truck Info */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Why Food Trucks?</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Support Local Business
            </h3>
            <p className="text-sm">
              We partner with local food entrepreneurs to bring you diverse, high-quality meals.
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Diverse Options
            </h3>
            <p className="text-sm">
              From BBQ to Korean fusion, there's something delicious for every taste preference.
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Perfect Pairing
            </h3>
            <p className="text-sm">
              Great food plus craft beer equals the perfect dining experience.
            </p>
          </Card>
        </div>
      </section>

      {/* Contact for Food Trucks */}
      <section className="text-center space-y-4 pt-8 border-t">
        <h2 className="text-xl font-semibold">Interested in Joining Our Food Truck Program?</h2>
        <p>
          We're always looking for amazing food trucks to partner with us. Contact us to learn more about opportunities.
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" asChild>
            <a href="mailto:info@lolev.beer">
              📧 info@lolev.beer
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="tel:4123368965">
              📱 (412) 336-8965
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}