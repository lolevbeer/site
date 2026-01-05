'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

/**
 * Calculate approximate sunset time for Pittsburgh (EST/EDT)
 * Uses a sine wave approximation based on day of year
 * Pittsburgh: 40.4°N latitude
 *
 * Winter solstice (Dec 21, day ~355): sunset ~16:55 (4:55 PM EST)
 * Summer solstice (Jun 21, day ~172): sunset ~20:55 (8:55 PM EDT)
 */
function getSunsetHour(date: Date): number {
  const dayOfYear = getDayOfYear(date);

  // Sine wave: peaks at summer solstice (day 172), troughs at winter solstice (day 355/day 0)
  // Offset by 80 days to align peak with June 21
  const angle = ((dayOfYear - 172) / 365) * 2 * Math.PI;

  // Sunset ranges from ~17:00 (5 PM) in winter to ~21:00 (9 PM) in summer
  // Center: 19:00, amplitude: 2 hours
  const sunsetHour = 19 - 2 * Math.cos(angle);

  return sunsetHour;
}

/**
 * Calculate approximate sunrise time for Pittsburgh (EST/EDT)
 */
function getSunriseHour(date: Date): number {
  const dayOfYear = getDayOfYear(date);

  // Sine wave for sunrise
  // Winter solstice: sunrise ~7:40 (7.67)
  // Summer solstice: sunrise ~5:50 (5.83)
  const angle = ((dayOfYear - 172) / 365) * 2 * Math.PI;

  // Center: 6.75, amplitude: 0.92 hours
  const sunriseHour = 6.75 + 0.92 * Math.cos(angle);

  return sunriseHour;
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Check if it's currently daytime in EST/EDT
 */
function isDaytime(): boolean {
  // Get current time in EST/EDT
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const currentHour = estTime.getHours() + estTime.getMinutes() / 60;
  const sunriseHour = getSunriseHour(estTime);
  const sunsetHour = getSunsetHour(estTime);

  return currentHour >= sunriseHour && currentHour < sunsetHour;
}

/**
 * Get milliseconds until next sunrise or sunset
 */
function getMsUntilNextTransition(): number {
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const currentHour = estTime.getHours() + estTime.getMinutes() / 60;
  const sunriseHour = getSunriseHour(estTime);
  const sunsetHour = getSunsetHour(estTime);

  let hoursUntilTransition: number;

  if (currentHour < sunriseHour) {
    // Before sunrise, wait until sunrise
    hoursUntilTransition = sunriseHour - currentHour;
  } else if (currentHour < sunsetHour) {
    // Daytime, wait until sunset
    hoursUntilTransition = sunsetHour - currentHour;
  } else {
    // After sunset, wait until tomorrow's sunrise
    hoursUntilTransition = (24 - currentHour) + getSunriseHour(new Date(estTime.getTime() + 24 * 60 * 60 * 1000));
  }

  // Convert to milliseconds, minimum 1 minute check
  return Math.max(hoursUntilTransition * 60 * 60 * 1000, 60 * 1000);
}

/**
 * Component that automatically switches theme based on EST time
 * when the user has selected "system" mode
 */
export function AutoThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    // Only auto-switch when theme is "system"
    if (theme !== 'system') return;

    function updateTheme() {
      const shouldBeDark = !isDaytime();
      const currentIsDark = document.documentElement.classList.contains('dark');

      if (shouldBeDark && !currentIsDark) {
        document.documentElement.classList.add('dark');
      } else if (!shouldBeDark && currentIsDark) {
        document.documentElement.classList.remove('dark');
      }
    }

    // Initial update
    updateTheme();

    // Schedule next check at sunrise/sunset transition
    const scheduleNextCheck = () => {
      const msUntilTransition = getMsUntilNextTransition();
      return setTimeout(() => {
        updateTheme();
        // Reschedule for next transition
        scheduleNextCheck();
      }, msUntilTransition);
    };

    const timeoutId = scheduleNextCheck();

    // Also check every minute as a fallback (handles timezone edge cases)
    const intervalId = setInterval(updateTheme, 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [theme]);

  return null;
}
