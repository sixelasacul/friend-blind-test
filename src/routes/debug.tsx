import { createFileRoute } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/debug')({
  component: RouteComponent
})

type Artists = (typeof api.artists.search)['_returnType']
type Track = (typeof api.debug.generateRelatedTrack)['_returnType']

function RouteComponent() {
  const [artists, setArtists] = useState<Artists>([])
  const [track, setTrack] = useState<Track>()
  // should debounce value or action directly
  const _searchArtists = useAction(api.artists.search)
  const _generateRelatedTrack = useAction(api.debug.generateRelatedTrack)

  async function searchArtists(query: string) {
    const artists = await _searchArtists({ query })
    setArtists(artists)
  }

  async function generateRelatedTrack(artist: string) {
    const track = await _generateRelatedTrack({ artist })
    setTrack(track)
  }

  return (
    <>
      <label>
        Search artist:
        <input onChange={(e) => searchArtists(e.target.value)} />
      </label>
      <ul>
        {artists.map((artist) => (
          <li key={artist.url}>
            <button onClick={() => generateRelatedTrack(artist.name)}>
              Select
            </button>{' '}
            {artist.name}
          </li>
        ))}
      </ul>
      {track && (
        <p>
          {track.artists.join(', ')} - {track.name}
        </p>
      )}
    </>
  )
}
