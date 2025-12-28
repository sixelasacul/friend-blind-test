import { createFileRoute } from '@tanstack/react-router'
import { useGameInfo } from '../../hooks/useGameInfo'

export const Route = createFileRoute('/$lobbyId/finished')({
  component: RouteComponent
})

function RouteComponent() {
  const gameInfo = useGameInfo()

  // could this be done in the `route` file?
  if (!gameInfo) return <p>Loading</p>

  return (
    <>
      <ul>
        {gameInfo.previousTracks.map((track) => (
          <li key={track._id}>
            {track.name} - {track.artists.join(', ')}
          </li>
        ))}
      </ul>
      <ul>
        {gameInfo.players.map((player) => (
          <li key={player._id}>
            {player.name} - {player.score}
          </li>
        ))}
      </ul>
    </>
  )
}
