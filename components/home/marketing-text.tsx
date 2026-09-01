'use client';

import React, { useEffect, useState } from 'react';
import type { Event as PayloadEvent } from '@/src/payload-types';
import { formatAbv } from '@/lib/utils/formatters';
import type { ComingSoonView, MarketingBeerView } from '@/lib/utils/homepage-view-models';
import { Button } from '@/components/ui/button';
import { useLocationContext } from '@/components/location/location-provider';
import { getLocationDisplayName } from '@/lib/config/locations';

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

type ComingSoonBeer = ComingSoonView
type SimpleBeer = MarketingBeerView

/** Minimal food shape covering both PayloadFood and RecurringFoodEntry */
interface MarketingFood {
  vendor: string | { name?: string; id?: string };
  date: string;
  time?: string;
}

interface MarketingTextProps {
  draftBeersByLocation: Record<string, SimpleBeer[]>;
  cansBeersByLocation: Record<string, SimpleBeer[]>;
  eventsByLocation: Record<string, PayloadEvent[]>;
  foodByLocation: Record<string, MarketingFood[]>;
  comingSoonBeers: ComingSoonBeer[];
}

export function MarketingText({
  draftBeersByLocation,
  cansBeersByLocation,
  eventsByLocation,
  foodByLocation,
  comingSoonBeers,
}: MarketingTextProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { locations } = useLocationContext();

  useEffect(() => {
    const checkHash = () => {
      setIsVisible(window.location.hash === '#marketing');
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  if (!isVisible) return null;

  const formatBeer = (beer: SimpleBeer) => {
    const abv = typeof beer.abv === 'string' ? parseFloat(beer.abv) : beer.abv;
    return `${beer.name} • ${beer.type} • ${formatAbv(abv)}`;
  };

  const formatEvent = (event: PayloadEvent, timezone: string) => {
    const date = new Date(event.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });
    const title = event.organizer || 'Event';
    let time = '';
    if (event.startTime && typeof event.startTime === 'string') {
      // startTime from Payload is an ISO string where only the time matters
      if (event.startTime.includes('T')) {
        const parsed = new Date(event.startTime);
        if (!isNaN(parsed.getTime())) {
          time = ` (${parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })})`;
        }
      } else {
        time = ` (${event.startTime.trim()})`;
      }
    }
    return `${dayName}, ${dateStr} • ${title}${time}`;
  };

  const formatFood = (food: MarketingFood, timezone: string) => {
    const date = new Date(food.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });
    const time = food.time ? ` (${food.time})` : '';
    const vendorName = typeof food.vendor === 'object' ? food.vendor?.name : food.vendor;
    return `${dayName}, ${dateStr} • ${vendorName}${time}`;
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Process events and food for each location
  const processedEventsByLocation: Record<string, PayloadEvent[]> = {};
  const processedFoodByLocation: Record<string, MarketingFood[]> = {};

  for (const [slug, events] of Object.entries(eventsByLocation)) {
    processedEventsByLocation[slug] = events
      .filter(event => new Date(event.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }

  for (const [slug, foods] of Object.entries(foodByLocation)) {
    processedFoodByLocation[slug] = foods
      .filter(food => new Date(food.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }

  const copySectionToClipboard = (sectionId: string) => {
    const textElement = document.getElementById(sectionId);
    if (textElement) {
      const text = textElement.innerText;
      navigator.clipboard.writeText(text);
    }
  };

  const getLocationName = (slug: string): string => getLocationDisplayName(locations, slug);

  // Get timezone for a location slug
  const getLocationTimezone = (slug: string): string => {
    const location = locations.find(loc => loc.slug === slug || loc.id === slug);
    return location?.timezone || 'America/New_York';
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
              {Object.entries(draftBeersByLocation).map(([slug, beers], index) => (
                <React.Fragment key={slug}>
                  {index > 0 && <div className="my-6" />}
                  <div>
                    <div className="mb-2">{toBoldUnicode(`${getLocationName(slug).toUpperCase()} - ON DRAFT`)}</div>
                    {beers.map((beer) => (
                      <div key={beer.variant}>{formatBeer(beer)}</div>
                    ))}
                  </div>
                </React.Fragment>
              ))}
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
              {Object.entries(cansBeersByLocation).map(([slug, beers], index) => (
                <React.Fragment key={slug}>
                  {index > 0 && <div className="my-6" />}
                  <div>
                    <div className="mb-2">{toBoldUnicode(`${getLocationName(slug).toUpperCase()} - CANS`)}</div>
                    {beers.map((beer) => (
                      <div key={beer.variant}>{formatBeer(beer)}</div>
                    ))}
                  </div>
                </React.Fragment>
              ))}
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
              {/* Events by location */}
              {Object.entries(processedEventsByLocation).map(([slug, events], index) => (
                events.length > 0 && (
                  <React.Fragment key={`events-${slug}`}>
                    {index > 0 && <div className="my-6" />}
                    <div>
                      <div className="mb-2">{toBoldUnicode(`${getLocationName(slug).toUpperCase()} - UPCOMING EVENTS`)}</div>
                      {events.map((event, eventIndex) => (
                        <div key={`${event.date}-${eventIndex}`}>{formatEvent(event, getLocationTimezone(slug))}</div>
                      ))}
                    </div>
                  </React.Fragment>
                )
              ))}

              {Object.values(processedEventsByLocation).some(events => events.length > 0) && <div className="my-6" />}

              {/* Food by location */}
              {Object.entries(processedFoodByLocation).map(([slug, foods], index) => (
                foods.length > 0 && (
                  <React.Fragment key={`food-${slug}`}>
                    {index > 0 && <div className="my-6" />}
                    <div>
                      <div className="mb-2">{toBoldUnicode(`${getLocationName(slug).toUpperCase()} - UPCOMING FOOD`)}</div>
                      {foods.map((food, foodIndex) => (
                        <div key={`${food.date}-${foodIndex}`}>{formatFood(food, getLocationTimezone(slug))}</div>
                      ))}
                    </div>
                  </React.Fragment>
                )
              ))}

              {Object.values(processedFoodByLocation).some(foods => foods.length > 0) && <div className="my-6" />}

              {/* Upcoming Beer Releases */}
              {comingSoonBeers.length > 0 && (
                <div>
                  <div className="mb-2">{toBoldUnicode('UPCOMING BEER RELEASES')}</div>
                  {comingSoonBeers.map((item, index) => (
                    <div key={index}>{item.name || item.styleName || 'Coming Soon'}</div>
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
