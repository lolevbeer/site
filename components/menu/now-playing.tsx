/**
 * Now Playing footer bar for menu displays.
 * Shows the currently playing Spotify track with album art, animated transitions.
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { NowPlaying as NowPlayingData } from '@/lib/utils/spotify'

interface NowPlayingProps {
  nowPlaying: NowPlayingData | null
}

/**
 * Compact footer bar showing currently playing Spotify track.
 * Slides in when a track is playing, slides out when stopped.
 * Animates track changes with a crossfade.
 */
export function NowPlaying({ nowPlaying }: NowPlayingProps) {
  const [displayed, setDisplayed] = useState<NowPlayingData | null>(null)
  const [visible, setVisible] = useState(false)
  const prevTrackRef = useRef<string | null>(null)

  useEffect(() => {
    if (nowPlaying?.isPlaying) {
      const trackKey = `${nowPlaying.trackName}::${nowPlaying.artistName}`
      // If track changed, briefly hide for crossfade
      if (prevTrackRef.current && prevTrackRef.current !== trackKey) {
        setVisible(false)
        const timeout = setTimeout(() => {
          setDisplayed(nowPlaying)
          setVisible(true)
        }, 300)
        prevTrackRef.current = trackKey
        return () => clearTimeout(timeout)
      }
      prevTrackRef.current = trackKey
      setDisplayed(nowPlaying)
      setVisible(true)
    } else {
      setVisible(false)
      prevTrackRef.current = null
    }
  }, [nowPlaying])

  if (!displayed) return null

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-500 ease-in-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-black/80 backdrop-blur-sm border-t border-white/10 px-4 py-2">
        <div className="flex items-center gap-3 max-w-screen-xl mx-auto">
          {/* Album art */}
          {displayed.albumArtUrl && (
            <div className="relative flex-shrink-0 rounded overflow-hidden" style={{ width: '2.5vh', height: '2.5vh', minWidth: 32, minHeight: 32 }}>
              <Image
                src={displayed.albumArtUrl}
                alt={displayed.albumName}
                fill
                className="object-cover"
                sizes="40px"
                unoptimized
              />
            </div>
          )}

          {/* Spotify icon + track info */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <svg className="flex-shrink-0 text-[#1DB954]" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="text-white font-medium truncate" style={{ fontSize: '1.6vh' }}>
                {displayed.trackName}
              </span>
              <span className="text-white/50" style={{ fontSize: '1.4vh' }}>•</span>
              <span className="text-white/60 truncate" style={{ fontSize: '1.4vh' }}>
                {displayed.artistName}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
