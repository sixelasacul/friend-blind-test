import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  getLobbyId,
  getPlayerArtists,
  getPlayerId,
  getPlayerName,
  setLobbyId,
  setPlayerId
} from '../../lib/playerStorage'
import { STATUS_TO_ROUTE_MAP } from '../../hooks/useGameInfo'
import { usePresence } from '../../hooks/usePresence'
import { IconLink, IconHelp, IconVolume } from '@tabler/icons-react'
import { Button } from '../../components/ui/button'

export const Route = createFileRoute('/$lobbyId')({
  component: RouteComponent,
  async beforeLoad({ context, params, matches }) {
    const lobbyId = params.lobbyId as Id<'lobbies'>

    const gameInfo = await context.convexHttpClient.query(
      api.lobbies.getGameInfo,
      {
        lobbyId
      }
    )

    // Join the lobby if not already, and save artists to the lobby

    let playerId = getPlayerId()
    const savedLobbyId = getLobbyId()
    const name = getPlayerName() ?? undefined
    const savedArtists = getPlayerArtists()

    if (playerId === null || savedLobbyId !== lobbyId) {
      const newPlayerId = await context.convexHttpClient.mutation(
        api.lobbies.join,
        {
          lobbyId,
          name
        }
      )

      // shouldn't be an issue if someone joins while the game is running since the
      // songs are generated
      if (savedArtists) {
        context.convexHttpClient.mutation(api.players.saveArtists, {
          playerId: newPlayerId,
          artists: savedArtists
        })
      }

      setPlayerId(newPlayerId)
      setLobbyId(lobbyId)
      playerId = newPlayerId
    }

    // Redirects to the proper route based on the game status

    // the longest route parsed from pathname
    const lastMatches = matches.at(-1)!

    const route = STATUS_TO_ROUTE_MAP[gameInfo.game.status]
    if (lastMatches.fullPath !== route) {
      throw redirect({
        to: route,
        params: {
          lobbyId
        }
      })
    }

    return {
      playerId,
      // also exposed via useParams, but we don't repeat the typing
      lobbyId
    }
  }
})

// should show player name + edit
function RouteComponent() {
  // usePresence();
  const { lobbyId } = Route.useRouteContext()

  return (
    <div className='mx-auto max-w-6xl'>
      <div className='mb-6 flex items-center justify-between'>
        <Link to='/'>
          <h1 className='text-2xl font-bold md:text-3xl'>Friend Blind Test</h1>
        </Link>
        <div className='flex items-center gap-3'>
          <Button variant='ghost' size='icon'>
            <IconLink className='h-5 w-5' />
          </Button>
          <Button variant='ghost' size='icon'>
            <IconHelp className='h-5 w-5' />
          </Button>
          <Button variant='ghost' size='icon'>
            <IconVolume className='h-5 w-5' />
          </Button>
        </div>
      </div>
      <Outlet />
    </div>
  )
}
