import { createFileRoute } from '@tanstack/react-router'
import {
  IconUser,
  IconSearch,
  IconSettings,
  IconVolume,
  IconX
} from '@tabler/icons-react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useEffect, useState } from 'react'
import { setPlayerArtists } from '../../lib/playerStorage'
import { useDebounce } from '../../lib/useDebounce'
import { useGameInfo } from '../../hooks/useGameInfo'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { ScrollArea } from '../../components/ui/scroll-area'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from '../../components/ui/combobox'
import { Label } from '../../components/ui/label'

const LAST_FM_PLACEHOLDER_IMAGE = '2a96cbd8b46e442fc41c2b86b821562f'

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
  const [artistsFromSearch, setArtistsFromSearch] = useState<Artist[]>([])

  const saveArtist = useMutation(api.players.saveArtist)
  const removeArtist = useMutation(api.players.removeArtist)
  const ready = useMutation(api.players.ready)

  useEffect(() => {
    if (debouncedSearch !== '') {
      searchArtist({ query: debouncedSearch }).then((res) =>
        setArtistsFromSearch(res)
      )
    } else {
      setArtistsFromSearch([])
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
    setArtistsFromSearch([])
    setSearch('')
  }

  console.log(artistsFromSearch)

  return (
    <>
      {/* Main Content */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {/* Left Panel - Artist Selection */}
        <div className='bg-card rounded-lg border p-4'>
          <h2 className='mb-4 text-xl font-semibold'>Artists</h2>

          {/* Search Input */}
          <div className='relative mb-4'>
            <Combobox<Artist>
              items={artistsFromSearch}
              onInputValueChange={setSearch}
              onValueChange={(artist) => {
                if (!artist) return
                saveArtistAndReset(artist)
              }}
            >
              <ComboboxInput
                placeholder='Search an artist or group...'
                showClear
              />
              <ComboboxContent>
                <ComboboxEmpty>
                  No artist or group found for this search
                </ComboboxEmpty>
                <ComboboxList>
                  {(artist: Artist) => (
                    <ComboboxItem value={artist}>
                      <>
                        <img src={artist.image[0]['#text']} />
                        <span>{artist.name}</span>
                      </>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {/* Selected Artists List */}
          <ScrollArea className='h-[400px] pr-4'>
            <div className='space-y-2'>
              {playerInfo?.artists.map((artist) => (
                <div
                  key={artist._id}
                  className='bg-muted hover:bg-muted/80 flex items-center justify-between rounded-md p-3'
                >
                  <span>{artist.name}</span>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-6 w-6'
                    onClick={() => removeArtist({ artistId: artist._id })}
                  >
                    <IconX className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Players */}
        <div className='bg-card rounded-lg border p-4'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-xl font-semibold'>Players</h2>
          </div>

          {/* Players List */}
          <ScrollArea className='h-[400px] pr-4'>
            <div className='space-y-2'>
              {gameInfo?.players.map((player) => (
                <div
                  key={player._id}
                  className='bg-muted flex items-center justify-between rounded-md p-3'
                >
                  <span>{player.name}</span>
                  <div className='flex items-center gap-2'>
                    <div
                      className={`h-2 w-2 rounded-full ${
                        player.ready ? 'bg-green-500' : 'bg-yellow-500'
                      }`}
                    />
                    <span className='text-muted-foreground text-sm'>
                      {player.ready ? 'Ready' : 'Not ready'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  )

  // return (
  //   <>
  //     {gameInfo?.game.status === "loading" && <h3>The game will start!</h3>}
  //     <button onClick={() => ready({ playerId })}>Ready</button>
  //     <h2>Artists</h2>
  //     {playerInfo && (
  //       <ul>
  //         {playerInfo.artists.map((artist) => (
  //           <li key={artist._id}>
  //             {artist.name}
  //             <button onClick={() => removeArtist({ artistId: artist._id })}>
  //               X
  //             </button>
  //           </li>
  //         ))}
  //       </ul>
  //     )}
  //     <label>
  //       Search more artists
  //       <input
  //         value={search}
  //         onChange={(e) => setSearch(e.target.value)}
  //         disabled={(playerInfo?.artists.length ?? 0) >= 5}
  //       />
  //     </label>
  //     {/* display image to disambiguate */}
  //     <ul>
  //       {results.map((result) => (
  //         <li key={result.mbid}>
  //           <button onClick={() => saveArtistAndReset(result)}>
  //             {result.name}
  //           </button>
  //         </li>
  //       ))}
  //     </ul>
  //     <PlayerInfo />
  //     <ArtistSearch />
  //   </>
  // );
}
