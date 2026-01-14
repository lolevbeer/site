'use client'

import { useState } from 'react'
import { useField, Button, Banner } from '@payloadcms/ui'

interface SearchResult {
  name: string
  url: string
  brewery?: string
}

export function UntappdFetcher() {
  const { value: beerName } = useField<string>({ path: 'name' })
  const { value: untappdUrl, setValue: setUntappdUrl } = useField<string>({ path: 'untappd' })
  const { setValue: setUntappdRating } = useField<number>({ path: 'untappdRating' })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)

  const handleSearch = async () => {
    if (!beerName) {
      setError('Beer name is required to search Untappd')
      return
    }

    setLoading(true)
    setError(null)
    setSearchResults(null)

    try {
      const response = await fetch(`/api/untappd?action=search&q=${encodeURIComponent(beerName)}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to search Untappd')
        return
      }

      if (data.results.length === 0) {
        setError('No results found on Untappd for "lolev ' + beerName + '"')
        return
      }

      if (data.results.length === 1) {
        // Auto-select single result
        const result = data.results[0]
        setUntappdUrl(result.url)
        setSearchResults(null)
        // Fetch rating for the selected URL
        await fetchRating(result.url)
      } else {
        // Show multiple results for selection
        setSearchResults(data.results)
      }
    } catch (err) {
      setError('Failed to connect to Untappd')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectResult = async (result: SearchResult) => {
    setUntappdUrl(result.url)
    setSearchResults(null)
    await fetchRating(result.url)
  }

  const fetchRating = async (url?: string) => {
    const targetUrl = url || untappdUrl
    if (!targetUrl) {
      setError('No Untappd URL set')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/untappd?action=rating&url=${encodeURIComponent(targetUrl)}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch rating')
        return
      }

      if (data.rating !== null) {
        setUntappdRating(data.rating)
      } else {
        setError('Could not find rating on page')
      }
    } catch (err) {
      setError('Failed to fetch rating')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      {error && (
        <Banner type="error" style={{ marginBottom: '10px' }}>
          {error}
        </Banner>
      )}

      {searchResults && searchResults.length > 1 && (
        <div style={{ marginBottom: '10px', padding: '10px', background: 'var(--theme-elevation-100)', borderRadius: '4px' }}>
          <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Multiple results found. Select one:</p>
          {searchResults.map((result, index) => (
            <Button
              key={index}
              buttonStyle="secondary"
              size="small"
              onClick={() => handleSelectResult(result)}
              style={{ marginRight: '8px', marginBottom: '8px' }}
            >
              {result.name}
            </Button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Button
          buttonStyle="secondary"
          size="small"
          onClick={handleSearch}
          disabled={loading || !beerName}
        >
          {loading ? 'Searching...' : 'Search Untappd'}
        </Button>

        {untappdUrl && (
          <>
            <Button
              buttonStyle="secondary"
              size="small"
              onClick={() => fetchRating()}
              disabled={loading}
            >
              {loading ? 'Fetching...' : 'Refresh Rating'}
            </Button>

            <Button
              buttonStyle="secondary"
              size="small"
              onClick={() => window.open(`https://untappd.com${untappdUrl}`, '_blank')}
            >
              View on Untappd
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
