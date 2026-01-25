import type { Doc } from '../../convex/_generated/dataModel'
import {
  getRouteApi,
  useMatchRoute,
  useNavigate,
  type MakeRouteMatch
} from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'

export const STATUS_TO_ROUTE_MAP: Record<
  Doc<'lobbies'>['status'],
  MakeRouteMatch['fullPath']
> = {
  waiting: '/$lobbyId/waiting',
  loading: '/$lobbyId/waiting',
  playing: '/$lobbyId/playing',
  paused: '/$lobbyId/playing',
  finished: '/$lobbyId/finished'
}

const Route = getRouteApi('/$lobbyId')

export function useGameInfo() {
  const { lobbyId } = Route.useRouteContext()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()

  const gameInfo = useQuery(api.lobbies.getGameInfo, {
    lobbyId
  })

  // Like the `/$lobbyId/route` layout, it redirects to the proper page based
  // on the status if not already on that page
  // Note: to be fair, I could not use the router for this and render screens
  // solely based on the state (like simple ifs), but I think it's cleaner this way
  useEffect(() => {
    if (gameInfo) {
      const route = STATUS_TO_ROUTE_MAP[gameInfo.game.status]
      if (!matchRoute({ to: route })) {
        navigate({ to: route, params: { lobbyId }, replace: true })
      }
    }
  }, [gameInfo, lobbyId, navigate, matchRoute])

  return gameInfo
}
