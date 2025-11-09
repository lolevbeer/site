'use client';

import React, { useEffect, useState } from 'react';
import { Beer } from '@/lib/types/beer';
import { BreweryEvent } from '@/lib/types/event';
import { FoodVendorSchedule } from '@/lib/types/food';
import { formatAbv } from '@/lib/utils/formatters';
import { Button } from '@/components/ui/button';

// Convert text to sans-serif bold Unicode characters (only used in marketing view)
function toBoldUnicode(text: string): string {
  const boldMap: { [key: string]: string } = {
    'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛',
    'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣',
    'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫',
    'Y': '𝗬', 'Z': '𝗭',
    'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵',
    'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽',
    'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅',
    'y': '𝘆', 'z': '𝘇'
  };

  return text.split('').map(char => boldMap[char] || char).join('');
}

interface UpcomingBeer {
  type: string;
  variant: string;
  tempName: string;
  displayName: string;
}

interface SimpleBeer {
  variant: string;
  name: string;
  type: string;
  abv: string | number;
}

interface SimpleEvent {
  date: string;
  vendor: string;
  time?: string;
  site?: string;
}

interface SimpleFood {
  vendor: string;
  date: string;
  time?: string;
  day?: string;
}

interface MarketingTextProps {
  lawrencevilleBeers: Beer[] | any; // Can be Beer[] or Menu object
  zelienopleBeers: Beer[] | any; // Can be Beer[] or Menu object
  lawrencevilleCans: SimpleBeer[] | any; // Can be SimpleBeer[] or Menu object
  zelienopleCans: SimpleBeer[] | any; // Can be SimpleBeer[] or Menu object
  lawrencevilleEvents: (BreweryEvent | SimpleEvent)[];
  zelienopleEvents: (BreweryEvent | SimpleEvent)[];
  lawrencevilleFood: (FoodVendorSchedule | SimpleFood)[];
  zelienopleFood: (FoodVendorSchedule | SimpleFood)[];
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

  // Helper to convert Menu to Beer array
  const convertMenuToBeers = (menuData: any): (Beer | SimpleBeer)[] => {
    if (!menuData) return [];
    if (Array.isArray(menuData)) return menuData;
    if (!menuData.items) return [];

    return menuData.items
      .map((item: any) => {
        const beer = item.beer;
        if (!beer) return null;

        return {
          variant: beer.slug || beer.variant,
          name: beer.name,
          type: beer.style?.name || beer.style || beer.type || '',
          abv: beer.abv || 0,
        };
      })
      .filter(Boolean);
  };

  // Convert Menu objects to arrays
  const lawrencevilleBeersArray = convertMenuToBeers(lawrencevilleBeers);
  const zelienopleBeersArray = convertMenuToBeers(zelienopleBeers);
  const lawrencevilleCansArray = convertMenuToBeers(lawrencevilleCans);
  const zelienopleCansArray = convertMenuToBeers(zelienopleCans);

  useEffect(() => {
    const checkHash = () => {
      setIsVisible(window.location.hash === '#marketing');
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  if (!isVisible) return null;

  const formatBeer = (beer: Beer | SimpleBeer) => {
    const abv = typeof beer.abv === 'string' ? parseFloat(beer.abv) : beer.abv;
    return `${beer.name} • ${beer.type} • ${formatAbv(abv)}`;
  };

  const formatEvent = (event: BreweryEvent | SimpleEvent) => {
    const date = new Date(event.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const title = ('title' in event && event.title) || event.vendor || 'Event';
    const time = event.time ? ` (${event.time.trim()})` : '';
    return `${dayName}, ${dateStr} • ${title}${time}`;
  };

  const formatFood = (food: FoodVendorSchedule | SimpleFood) => {
    const date = new Date(food.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const time = food.time ? ` (${food.time.trim()})` : '';
    return `${dayName}, ${dateStr} • ${food.vendor}${time}`;
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

  const copySectionToClipboard = (sectionId: string) => {
    const textElement = document.getElementById(sectionId);
    if (textElement) {
      const text = textElement.innerText;
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Marketing Copy</h1>
        </div>

        <div id="marketing-text-content" className="space-y-8 font-mono text-sm whitespace-pre-wrap">
          {/* Draft Section */}
          <div className="relative">
            <Button
              onClick={() => copySectionToClipboard('draft-section')}
              variant="ghost"
              size="sm"
              className="absolute top-0 right-0"
            >
              Copy Draft
            </Button>
            <div id="draft-section">
              {/* Lawrenceville Draft */}
              <div>
                <div className="mb-2">{toBoldUnicode('LAWRENCEVILLE - ON DRAFT')}</div>
                {lawrencevilleBeersArray.map((beer) => (
                  <div key={beer.variant}>{formatBeer(beer)}</div>
                ))}
              </div>

              <div className="my-6" />

              {/* Zelienople Draft */}
              <div>
                <div className="mb-2">{toBoldUnicode('ZELIENOPLE - ON DRAFT')}</div>
                {zelienopleBeersArray.map((beer) => (
                  <div key={beer.variant}>{formatBeer(beer)}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-foreground my-4"></div>

          {/* Cans Section */}
          <div className="relative">
            <Button
              onClick={() => copySectionToClipboard('cans-section')}
              variant="ghost"
              size="sm"
              className="absolute top-0 right-0"
            >
              Copy Cans
            </Button>
            <div id="cans-section">
              {/* Lawrenceville Cans */}
              <div>
                <div className="mb-2">{toBoldUnicode('LAWRENCEVILLE - CANS')}</div>
                {lawrencevilleCansArray.map((beer) => (
                  <div key={beer.variant}>{formatBeer(beer)}</div>
                ))}
              </div>

              <div className="my-6" />

              {/* Zelienople Cans */}
              <div>
                <div className="mb-2">{toBoldUnicode('ZELIENOPLE - CANS')}</div>
                {zelienopleCansArray.map((beer) => (
                  <div key={beer.variant}>{formatBeer(beer)}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-foreground my-4"></div>

          {/* Upcoming Section */}
          <div className="relative">
            <Button
              onClick={() => copySectionToClipboard('upcoming-section')}
              variant="ghost"
              size="sm"
              className="absolute top-0 right-0"
            >
              Copy Upcoming
            </Button>
            <div id="upcoming-section">
              {/* Lawrenceville Events */}
              {upcomingLawrencevilleEvents.length > 0 && (
                <div>
                  <div className="mb-2">{toBoldUnicode('LAWRENCEVILLE - UPCOMING EVENTS')}</div>
                  {upcomingLawrencevilleEvents.map((event, index) => (
                    <div key={`${event.date}-${index}`}>{formatEvent(event)}</div>
                  ))}
                </div>
              )}

              {upcomingLawrencevilleEvents.length > 0 && <div className="my-6" />}

              {/* Zelienople Events */}
              {upcomingZelienopleEvents.length > 0 && (
                <div>
                  <div className="mb-2">{toBoldUnicode('ZELIENOPLE - UPCOMING EVENTS')}</div>
                  {upcomingZelienopleEvents.map((event, index) => (
                    <div key={`${event.date}-${index}`}>{formatEvent(event)}</div>
                  ))}
                </div>
              )}

              {upcomingZelienopleEvents.length > 0 && <div className="my-6" />}

              {/* Lawrenceville Food */}
              {upcomingLawrencevilleFood.length > 0 && (
                <div>
                  <div className="mb-2">{toBoldUnicode('LAWRENCEVILLE - UPCOMING FOOD')}</div>
                  {upcomingLawrencevilleFood.map((food, index) => (
                    <div key={`${food.date}-${index}`}>{formatFood(food)}</div>
                  ))}
                </div>
              )}

              {upcomingLawrencevilleFood.length > 0 && <div className="my-6" />}

              {/* Zelienople Food */}
              {upcomingZelienopleFood.length > 0 && (
                <div>
                  <div className="mb-2">{toBoldUnicode('ZELIENOPLE - UPCOMING FOOD')}</div>
                  {upcomingZelienopleFood.map((food, index) => (
                    <div key={`${food.date}-${index}`}>{formatFood(food)}</div>
                  ))}
                </div>
              )}

              {upcomingZelienopleFood.length > 0 && <div className="my-6" />}

              {/* Upcoming Beer Releases */}
              {upcomingBeers.length > 0 && (
                <div>
                  <div className="mb-2">{toBoldUnicode('UPCOMING BEER RELEASES')}</div>
                  {upcomingBeers.map((beer, index) => (
                    <div key={index}>{beer.displayName}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
