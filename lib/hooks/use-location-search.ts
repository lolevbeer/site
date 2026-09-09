import { useState, useEffect, useRef, useCallback } from 'react'
import { logger } from '@/lib/utils/logger'
import { parseMapboxFeatures, type PlaceSuggestion } from '@/lib/map/search'

const SEARCH_DEBOUNCE = 300

function mapboxToken(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ''
}

interface Coordinates {
  latitude: number
  longitude: number
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

const fetchPlaceSuggestions = async (
  query: string,
  proximity: Coordinates | null,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> => {
  const token = mapboxToken()
  if (!token || query.trim().length < 2) return []
  if (signal?.aborted) return []

  const proximityParam = proximity
    ? `&proximity=${proximity.longitude},${proximity.latitude}`
    : ''
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${token}&country=US&types=place,postcode,locality,neighborhood,address&limit=5${proximityParam}`,
      { signal },
    )
    if (!response.ok) return []
    const data = await response.json()
    return parseMapboxFeatures(data.features || [])
  } catch (error) {
    if (isAbortError(error)) return []
    logger.error('Place suggest error:', error)
    return []
  }
}

export function useLocationSearch(proximity: Coordinates | null = null) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<{
    term: string
    coords: Coordinates
    label: string
  } | null>(null)
  const [fetched, setFetched] = useState<{ term: string; places: PlaceSuggestion[] }>({
    term: '',
    places: [],
  })
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const searchLocation =
    selectedPlace && selectedPlace.term === searchTerm ? selectedPlace.coords : null
  const searchLabel =
    selectedPlace && selectedPlace.term === searchTerm ? selectedPlace.label : null
  const trimmed = searchTerm.trim()
  const committed = Boolean(selectedPlace && selectedPlace.term === searchTerm)
  const isSearching = searching && trimmed.length >= 2 && !committed
  const placeSuggestions =
    trimmed.length < 2 || committed || fetched.term !== trimmed ? [] : fetched.places
  const proximityLat = proximity?.latitude
  const proximityLng = proximity?.longitude

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    requestIdRef.current += 1
  }, [])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    const term = searchTerm.trim()
    if (term.length < 2 || (selectedPlace && selectedPlace.term === searchTerm)) {
      cancelInFlight()
      return
    }

    const proximityForFetch = selectedPlace?.coords
      ? selectedPlace.coords
      : proximityLat != null && proximityLng != null
        ? { latitude: proximityLat, longitude: proximityLng }
        : null
    searchTimeoutRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const id = ++requestIdRef.current
      setSearching(true)
      const suggestions = await fetchPlaceSuggestions(term, proximityForFetch, controller.signal)
      if (id !== requestIdRef.current) return
      setFetched({ term, places: suggestions })
      setSearching(false)
    }, SEARCH_DEBOUNCE)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchTerm, proximityLat, proximityLng, selectedPlace, cancelInFlight])

  const selectPlace = useCallback(
    (suggestion: PlaceSuggestion) => {
      if (suggestion.latitude == null || suggestion.longitude == null) return
      const label = suggestion.label
      cancelInFlight()
      setSearchTerm(label)
      setSelectedPlace({
        term: label,
        coords: { latitude: suggestion.latitude, longitude: suggestion.longitude },
        label: suggestion.subtitle || suggestion.label,
      })
      setFetched({ term: '', places: [] })
      setSearching(false)
    },
    [cancelInFlight],
  )

  const commitTypedPlace = useCallback(async () => {
    const term = searchTerm.trim()
    if (!term) return false
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const id = ++requestIdRef.current
    setSearching(true)
    const proximityForFetch = selectedPlace?.coords
      ? selectedPlace.coords
      : proximityLat != null && proximityLng != null
        ? { latitude: proximityLat, longitude: proximityLng }
        : null
    const suggestions = await fetchPlaceSuggestions(term, proximityForFetch, controller.signal)
    if (id !== requestIdRef.current) return false
    setSearching(false)
    const suggestion = suggestions[0]
    if (!suggestion?.latitude || suggestion.longitude == null) {
      setFetched({ term: '', places: [] })
      return false
    }
    setSelectedPlace({
      term: searchTerm,
      coords: { latitude: suggestion.latitude, longitude: suggestion.longitude },
      label: suggestion.subtitle || suggestion.label,
    })
    setFetched({ term: '', places: [] })
    return true
  }, [searchTerm, proximityLat, proximityLng, selectedPlace])

  const clearSearch = useCallback(() => {
    cancelInFlight()
    setSearchTerm('')
    setSelectedPlace(null)
    setFetched({ term: '', places: [] })
    setSearching(false)
  }, [cancelInFlight])

  return {
    searchTerm,
    setSearchTerm,
    searchLocation,
    searchLabel,
    isSearching,
    placeSuggestions,
    selectPlace,
    commitTypedPlace,
    clearSearch,
  }
}
