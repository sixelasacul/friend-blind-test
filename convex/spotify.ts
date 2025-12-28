import { customAction, customCtx } from 'convex-helpers/server/customFunctions'
import { SpotifyApi } from '@spotify/web-api-ts-sdk'
import { internalAction } from './_generated/server'

export function getSpotifySdk() {
  return SpotifyApi.withClientCredentials(
    process.env.SPOTIFY_CLIENT_ID!,
    process.env.SPOTIFY_CLIENT_SECRET!
  )
}

export const spotifyInternalAction = customAction(
  internalAction,
  customCtx(() => {
    return { spotify: getSpotifySdk() }
  })
)
