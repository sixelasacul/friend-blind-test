import { IconX } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/convex/api'
import { useGameInfo } from '@/hooks/useGameInfo'
import { setPlayerArtists } from '@/lib/playerStorage'
import { useDebounce } from '@/lib/useDebounce'
import { cn } from '@/lib/utils'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from '../../components/ui/combobox'

// LAST FM DOESN'T RETURN IMAGES ANYMORE:
// https://stackoverflow.com/questions/55978243/last-fm-api-returns-same-white-star-image-for-all-artists
// People suggest to use MusicBrainz directly, as I also commented in LastFmApi
// Or I can react for their API to start with: https://musicbrainz.org/doc/MusicBrainz_API

export const Route = createFileRoute('/$lobbyId/waiting')({
  component: RouteComponent
})

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
  const updateName = useMutation(api.players.updateName)

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

  return (
    <>
      {/* Main Content */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {/* Left Panel - Artist Selection */}
        <div className='rounded-lg border bg-card p-4'>
          <h2 className='mb-4 text-xl font-semibold'>Artists</h2>

          {/* Search Input */}
          <div className='relative mb-4'>
            <Combobox<Artist>
              items={artistsFromSearch}
              itemToStringLabel={(artist) => artist.name}
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
                      <span>{artist.name}</span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {/* Selected Artists List */}
          <ScrollArea className='h-100 pr-4'>
            <div className='space-y-2'>
              {playerInfo?.artists.map((artist) => (
                <div
                  key={artist._id}
                  className='flex items-center justify-between rounded-md bg-muted p-3 hover:bg-muted/80'
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
        <div className='rounded-lg border bg-card p-4'>
          <h2 className='mb-4 text-xl font-semibold'>Players</h2>

          {/* Your Profile Section */}
          {playerInfo && (
            <YourProfile
              name={playerInfo.player.name}
              ready={playerInfo.player.ready}
              onReady={() => ready({ playerId })}
              onUpdateName={(name) => updateName({ name, playerId })}
            />
          )}

          {/* All Players List */}
          <div className='mt-4 mb-2 border-t pt-4'>
            <span className='text-sm font-medium text-muted-foreground'>
              All Players
            </span>
          </div>
          <ScrollArea className='h-72 pr-4'>
            <div className='space-y-2'>
              {gameInfo?.players.map((player) => (
                <PlayerListItem
                  key={player._id}
                  name={player.name}
                  ready={player.ready}
                  isCurrentPlayer={player._id === playerId}
                />
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

type YourProfileProps = {
  name: string
  ready: boolean
  onReady: () => void
  onUpdateName: (name: string) => void
}

function YourProfile({ name, ready, onReady, onUpdateName }: YourProfileProps) {
  return (
    <div className='rounded-lg border p-4'>
      <h3 className='mb-3 text-sm font-medium text-muted-foreground'>
        Your Profile
      </h3>
      <div className='flex items-center gap-3'>
        <Input
          defaultValue={name}
          onBlur={(e) => onUpdateName(e.target.value)}
          className='flex-1'
          placeholder='Enter your name'
        />
        <Button
          variant={ready ? 'default' : 'outline'}
          onClick={onReady}
          className='shrink-0'
        >
          {ready ? '✓ Ready' : 'Ready up'}
        </Button>
      </div>
    </div>
  )
}

type PlayerListItemProps = {
  name: string
  ready: boolean
  isCurrentPlayer: boolean
}

function PlayerListItem({ name, ready, isCurrentPlayer }: PlayerListItemProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md p-3',
        isCurrentPlayer ? 'border border-primary/30 bg-primary/5' : 'bg-muted'
      )}
    >
      <div className='flex items-center gap-2'>
        <span>{name}</span>
        {isCurrentPlayer && (
          <span className='text-xs text-muted-foreground'>(You)</span>
        )}
      </div>
      <div className='flex items-center gap-2'>
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            ready ? 'bg-green-500' : 'bg-yellow-500'
          )}
        />
        <span className='text-sm text-muted-foreground'>
          {ready ? 'Ready' : 'Not ready'}
        </span>
      </div>
    </div>
  )
}
