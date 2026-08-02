/**
 * Beer data utilities using Payload CMS
 * Fetches beers and enriches them with menu availability data
 */

import { Beer } from '@/lib/types/beer'
import { getAllBeersFromPayload, getMenusByLocation, getAllLocations } from './payload-api'
import { getBeersWithAvailability } from './payload-adapter'
import { cache } from 'react'

/**
 * Get all beers from Payload CMS with availability data
 */
export const getAllBeers = cache(async (): Promise<Beer[]> => {
  const payloadBeers = await getAllBeersFromPayload()

  const locations = await getAllLocations()
  const locationSlugs = locations.map((loc) => loc.slug || loc.id)

  const menuPromises = locationSlugs.map((slug) => getMenusByLocation(slug))
  const menusByLocation = await Promise.all(menuPromises)

  const allMenus = menusByLocation.flat()

  return getBeersWithAvailability(payloadBeers, allMenus)
})
