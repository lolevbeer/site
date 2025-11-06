'use client';

import React, { useEffect, useState } from 'react';
import { Beer } from '@/lib/types/beer';
import { BreweryEvent } from '@/lib/types/event';
import { FoodVendorSchedule } from '@/lib/types/food';
import { formatAbv } from '@/lib/utils/formatters';
import { Button } from '@/components/ui/button';

interface UpcomingBeer {
  type: string;
  variant: string;
  tempName: string;
  displayName: string;
}

interface MarketingTextProps {
  lawrencevilleBeers: Beer[];
  zelienopleBeers: Beer[];
  lawrencevilleCans: Beer[];
  zelienopleCans: Beer[];
  lawrencevilleEvents: BreweryEvent[];
  zelienopleEvents: BreweryEvent[];
  lawrencevilleFood: FoodVendorSchedule[];
  zelienopleFood: FoodVendorSchedule[];
  upcomingBeers: UpcomingBeer[];
}

export function MarketingText({
  lawrencevilleBeers,
  zelienopleBeers,
  lawrencevilleCans,
  zelienopleCans,
  lawrencevilleEvents,
  zelienopleEvents,
  lawrencevilleFood,
  zelienopleFood,
  upcomingBeers,
}: MarketingTextProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkHash = () => {
      setIsVisible(window.location.hash === '#marketing');
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  if (!isVisible) return null;

  const formatBeer = (beer: Beer) => {
    return `${beer.name} • ${beer.type} • ${formatAbv(beer.abv)}`;
  };

  const formatEvent = (event: BreweryEvent) => {
    const date = new Date(event.date);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const title = event.title || event.vendor || 'Event';
    const time = event.time ? ` (${event.time.trim()})` : '';
    return `${dateStr} - ${title}${time}`;
  };

  const formatFood = (food: FoodVendorSchedule) => {
    const date = new Date(food.date);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const time = food.time ? ` (${food.time.trim()})` : '';
    return `${dateStr} - ${food.vendor}${time}`;
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcomingLawrencevilleEvents = lawrencevilleEvents
    .filter(event => new Date(event.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  const upcomingZelienopleEvents = zelienopleEvents
    .filter(event => new Date(event.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  const upcomingLawrencevilleFood = lawrencevilleFood
    .filter(food => new Date(food.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  const upcomingZelienopleFood = zelienopleFood
    .filter(food => new Date(food.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  const copyToClipboard = () => {
    const textElement = document.getElementById('marketing-text-content');
    if (textElement) {
      const text = textElement.innerText;
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Marketing Copy</h1>
          <div className="flex gap-2">
            <Button onClick={copyToClipboard} variant="default">
              Copy to Clipboard
            </Button>
            <Button onClick={() => window.location.hash = ''} variant="outline">
              Close
            </Button>
          </div>
        </div>

        <div id="marketing-text-content" className="space-y-8 font-mono text-sm whitespace-pre-wrap">
          {/* Lawrenceville Draft */}
          <div>
            <div className="font-bold mb-2">LAWRENCEVILLE - ON DRAFT</div>
            {lawrencevilleBeers.map((beer) => (
              <div key={beer.variant}>{formatBeer(beer)}</div>
            ))}
          </div>

          {/* Zelienople Draft */}
          <div>
            <div className="font-bold mb-2">ZELIENOPLE - ON DRAFT</div>
            {zelienopleBeers.map((beer) => (
              <div key={beer.variant}>{formatBeer(beer)}</div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t-2 border-foreground my-4"></div>

          {/* Lawrenceville Cans */}
          <div>
            <div className="font-bold mb-2">LAWRENCEVILLE - CANS</div>
            {lawrencevilleCans.map((beer) => (
              <div key={beer.variant}>{formatBeer(beer)}</div>
            ))}
          </div>

          {/* Zelienople Cans */}
          <div>
            <div className="font-bold mb-2">ZELIENOPLE - CANS</div>
            {zelienopleCans.map((beer) => (
              <div key={beer.variant}>{formatBeer(beer)}</div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t-2 border-foreground my-4"></div>

          {/* Lawrenceville Events */}
          {upcomingLawrencevilleEvents.length > 0 && (
            <div>
              <div className="font-bold mb-2">LAWRENCEVILLE - UPCOMING EVENTS</div>
              {upcomingLawrencevilleEvents.map((event, index) => (
                <div key={`${event.date}-${index}`}>{formatEvent(event)}</div>
              ))}
            </div>
          )}

          {/* Zelienople Events */}
          {upcomingZelienopleEvents.length > 0 && (
            <div>
              <div className="font-bold mb-2">ZELIENOPLE - UPCOMING EVENTS</div>
              {upcomingZelienopleEvents.map((event, index) => (
                <div key={`${event.date}-${index}`}>{formatEvent(event)}</div>
              ))}
            </div>
          )}

          {/* Lawrenceville Food */}
          {upcomingLawrencevilleFood.length > 0 && (
            <div>
              <div className="font-bold mb-2">LAWRENCEVILLE - UPCOMING FOOD</div>
              {upcomingLawrencevilleFood.map((food, index) => (
                <div key={`${food.date}-${index}`}>{formatFood(food)}</div>
              ))}
            </div>
          )}

          {/* Zelienople Food */}
          {upcomingZelienopleFood.length > 0 && (
            <div>
              <div className="font-bold mb-2">ZELIENOPLE - UPCOMING FOOD</div>
              {upcomingZelienopleFood.map((food, index) => (
                <div key={`${food.date}-${index}`}>{formatFood(food)}</div>
              ))}
            </div>
          )}

          {/* Upcoming Beer Releases */}
          {upcomingBeers.length > 0 && (
            <div>
              <div className="font-bold mb-2">UPCOMING BEER RELEASES</div>
              {upcomingBeers.map((beer, index) => (
                <div key={index}>{beer.displayName}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
