/**
 * Pittsburgh sunrise/sunset calculations for menu display theming
 * Uses sine wave approximation based on Pittsburgh's latitude (40.4°N)
 */

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Calculate approximate sunset time for Pittsburgh (EST/EDT)
 * Winter solstice (Dec 21): ~17:00 (5 PM EST)
 * Summer solstice (Jun 21): ~21:00 (9 PM EDT)
 */
function getSunsetHour(date: Date): number {
  const dayOfYear = getDayOfYear(date);
  const angle = ((dayOfYear - 172) / 365) * 2 * Math.PI;
  // + cos: peaks at summer (day 172), troughs at winter
  return 19 + 2 * Math.cos(angle);
}

/**
 * Calculate approximate sunrise time for Pittsburgh (EST/EDT)
 * Winter solstice: ~7:40 AM (late sunrise)
 * Summer solstice: ~5:50 AM (early sunrise)
 */
function getSunriseHour(date: Date): number {
  const dayOfYear = getDayOfYear(date);
  const angle = ((dayOfYear - 172) / 365) * 2 * Math.PI;
  // - cos: troughs at summer (early), peaks at winter (late)
  return 6.75 - 0.92 * Math.cos(angle);
}

/**
 * Check if it's currently daytime in Pittsburgh (EST/EDT)
 */
export function isDaytimeInPittsburgh(): boolean {
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const currentHour = estTime.getHours() + estTime.getMinutes() / 60;
  const sunriseHour = getSunriseHour(estTime);
  const sunsetHour = getSunsetHour(estTime);

  return currentHour >= sunriseHour && currentHour < sunsetHour;
}

/**
 * Get the current theme for Pittsburgh time
 */
export function getPittsburghTheme(): 'light' | 'dark' {
  return isDaytimeInPittsburgh() ? 'light' : 'dark';
}

/**
 * Get milliseconds until next sunrise or sunset in Pittsburgh
 */
export function getMsUntilNextTransition(): number {
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const currentHour = estTime.getHours() + estTime.getMinutes() / 60;
  const sunriseHour = getSunriseHour(estTime);
  const sunsetHour = getSunsetHour(estTime);

  let hoursUntilTransition: number;

  if (currentHour < sunriseHour) {
    hoursUntilTransition = sunriseHour - currentHour;
  } else if (currentHour < sunsetHour) {
    hoursUntilTransition = sunsetHour - currentHour;
  } else {
    const tomorrow = new Date(estTime.getTime() + 24 * 60 * 60 * 1000);
    hoursUntilTransition = (24 - currentHour) + getSunriseHour(tomorrow);
  }

  // Convert to milliseconds, minimum 1 minute
  return Math.max(hoursUntilTransition * 60 * 60 * 1000, 60 * 1000);
}
