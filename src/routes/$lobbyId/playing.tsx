import {
  IconUser,
  IconSearch,
  IconSettings,
  IconVolume,
  IconX
} from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Volume } from '../../components/Volume'
import { useGameInfo } from '../../hooks/useGameInfo'
import { useVolume } from '../../hooks/useVolume'
import { setPlayerArtists } from '../../lib/playerStorage'
import { useDebounce } from '../../lib/useDebounce'

export const Route = createFileRoute('/$lobbyId/playing')({
  component: RouteComponent
})

// https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
function RouteComponent() {
  const { lobbyId, playerId } = Route.useRouteContext()
  const gameInfo = useGameInfo()

  const { audioRef, defaultVolume, onVolumeChange } = useVolume()

  // when someone joins after the music has started, sync the audio with the others
  useEffect(() => {
    if (!audioRef.current || gameInfo?.game.status !== 'playing') return

    const diff = Date.now() - (gameInfo?.game.startedTrackAt ?? Date.now())
    if (diff > 1_000) {
      audioRef.current.currentTime = diff / 1000
    }
    audioRef.current.play()
  }, [audioRef, gameInfo?.game.status, gameInfo?.game.startedTrackAt])

  const guessPlayer = useMutation(api.answers.guessPlayer)

  const [answerText, setAnswerText] = useState('')
  const guessTrackNameAndArtists = useMutation(
    api.answers.guessTrackNameAndArtists
  )
  const answer = useQuery(api.answers.getPlayerAnswer, { lobbyId, playerId })
  // if answer.partialAnswer gets longer after `guessTrackNameAndArtists`, we
  // can notify the player

  if (!gameInfo || !answer) {
    return <p>Loading</p>
  }

  const { currentGameTrack, previousTracks, players } = gameInfo
  const { guessedArtistsAt, guessedPlayerAt, guessedTrackNameAt } = answer

  return (
    <>
      {/* Guess Input Section */}
      <div className='mb-6 space-y-3'>
        <div className='flex flex-col gap-3 sm:flex-row'>
          <div className='relative flex-1'>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                // or perhaps use withOptimistic?
                guessTrackNameAndArtists({
                  answerText,
                  lobbyId,
                  playerId
                }).then(() => setAnswerText(''))
              }}
            >
              <Input
                placeholder='Guess'
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                className='text-lg'
              />
            </form>
            {/*{isClose && (
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-orange-500 font-medium">
                  Close!
                </span>
              )}*/}
          </div>
          <div className='flex gap-3'>
            <div className='flex min-w-[60px] items-center justify-center rounded-md border bg-card px-4 py-2'>
              {/*<span className="text-lg font-semibold">{timeRemaining}</span>*/}
            </div>
            {/*<Button variant="outline">Skip</Button>*/}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {/* Left Panel - Track History */}
        <div className='rounded-lg border bg-card p-4'>
          <h2 className='mb-4 text-xl font-semibold'>Tracks</h2>
          <ScrollArea className='h-[400px] pr-4'>
            <div className='space-y-2'>
              {previousTracks.map((track, index) => (
                <div
                  key={track._id}
                  className={`rounded-md p-3 ${
                    track._id === currentGameTrack._id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className='font-medium'>Current track</div>
                  <div className='text-sm'>Track #{index + 1}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Player Scores */}
        <div className='rounded-lg border bg-card p-4'>
          <h2 className='mb-4 text-xl font-semibold'>Scores</h2>
          <ScrollArea className='h-[400px] pr-4'>
            <div className='space-y-2'>
              {players
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div
                    key={player._id}
                    className='flex items-center justify-between rounded-md bg-muted p-3'
                  >
                    <div className='flex items-center gap-3'>
                      <span className='w-6 font-medium text-muted-foreground'>
                        #{index + 1}
                      </span>
                      <span className='font-medium'>{player.name}</span>
                    </div>
                    <span className='text-lg font-bold'>{player.score}</span>
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
  //     <audio ref={audioRef} src={currentGameTrack.previewUrl} />
  //     {/* would be nice to have this in the waiting route without duplication
  //     (putting it in the layout, but that means I don't have access to the audio
  //     element, so should I move it up too??)
  //     I guess I could do an overall Audio component that handles everything? */}
  //     <Volume defaultVolume={defaultVolume} onVolumeChange={onVolumeChange} />

  //     <form
  //       onSubmit={(e) => {
  //         e.preventDefault();
  //         // or perhaps use withOptimistic?
  //         guessTrackNameAndArtists({ answerText, lobbyId, playerId }).then(() =>
  //           setAnswerText(""),
  //         );
  //       }}
  //     >
  //       <label>
  //         Guess the track name and artists
  //         <input
  //           value={answerText}
  //           onChange={(e) => setAnswerText(e.target.value)}
  //         />
  //       </label>
  //       <button type="submit">Guess</button>
  //     </form>

  //     {!!guessedTrackNameAt && <p>Guessed track name</p>}
  //     {!!guessedArtistsAt && <p>Guessed artists</p>}
  //     {!!guessedPlayerAt && <p>Guessed player</p>}

  //     <ul>
  //       {players.map((player) => (
  //         <li key={player._id}>
  //           <button
  //             onClick={() =>
  //               guessPlayer({ playerId, lobbyId, guessedPlayerId: player._id })
  //             }
  //           >
  //             Vote
  //           </button>
  //           <p>
  //             <span>{player.name}</span> (<span>{player.score}</span>)
  //             {player.guessedTrackNameAt && <span>Guessed track name</span>}
  //             {player.guessedArtistsAt && <span>Guessed artists</span>}
  //             {player.guessedPlayerAt && <span>Guessed player</span>}
  //           </p>
  //         </li>
  //       ))}
  //     </ul>

  //     <ul>
  //       {previousTracks.map((track) => (
  //         <li key={track._id}>
  //           {track.name} - {track.artists.join(", ")} (from{" "}
  //           {track.sourcePlayer.name})
  //         </li>
  //       ))}
  //     </ul>
  //   </>
  // );
}
