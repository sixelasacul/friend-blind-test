import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useGameInfo } from '../../hooks/useGameInfo'
import { setPlayerArtists } from '../../lib/playerStorage'
import { useDebounce } from '../../lib/useDebounce'

export const Route = createFileRoute('/$lobbyId/waiting')({
  component: RouteComponent
})

function ArtistSearch() {
  const { playerId } = Route.useRouteContext()
  useQuery(api.players.getPlayerInfo, { playerId })
  return null
}

function PlayerInfo() {
  const { playerId } = Route.useRouteContext()
  useQuery(api.players.getPlayerInfo, { playerId })
  return null
}

function RouteComponent() {
  const { playerId } = Route.useRouteContext()

  const playerInfo = useQuery(api.players.getPlayerInfo, { playerId })
  const gameInfo = useGameInfo()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const searchArtist = useAction(api.artists.search)
  type Artist = Awaited<ReturnType<typeof searchArtist>>[number]
  const [results, setResults] = useState<Artist[]>([])

  const saveArtist = useMutation(api.players.saveArtist)
  const removeArtist = useMutation(api.players.removeArtist)
  const ready = useMutation(api.players.ready)

  useEffect(() => {
    if (debouncedSearch !== '') {
      searchArtist({ query: debouncedSearch }).then((res) => setResults(res))
    } else {
      setResults([])
    }
  }, [debouncedSearch, searchArtist])

  useEffect(() => {
    if (playerInfo) {
      setPlayerArtists(
        playerInfo.artists.map((artist) => {
          const { name, externalId } = artist
          return {
            name,
            externalId
          }
        })
      )
    }
  }, [playerInfo])

  async function saveArtistAndReset({ mbid, name }: Artist) {
    await saveArtist({ playerId, artist: { externalId: mbid, name } })
    setResults([])
    setSearch('')
  }

  return (
    <>
      {gameInfo?.game.status === 'loading' && <h3>The game will start!</h3>}
      <button onClick={() => ready({ playerId })}>Ready</button>
      <h2>Artists</h2>
      {playerInfo && (
        <ul>
          {playerInfo.artists.map((artist) => (
            <li key={artist._id}>
              {artist.name}
              <button onClick={() => removeArtist({ artistId: artist._id })}>
                X
              </button>
            </li>
          ))}
        </ul>
      )}
      <label>
        Search more artists
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={(playerInfo?.artists.length ?? 0) >= 5}
        />
      </label>
      {/* display image to disambiguate */}
      <ul>
        {results.map((result) => (
          <li key={result.mbid}>
            <button onClick={() => saveArtistAndReset(result)}>
              {result.name}
            </button>
          </li>
        ))}
      </ul>
      <PlayerInfo />
      <ArtistSearch />
    </>
  )
}
