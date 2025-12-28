import { v } from 'convex/values'
import { Doc } from './_generated/dataModel'
import { action } from './_generated/server'
import { getLastFmSdk } from './lastFm'
import { getSpotifySdk } from './spotify'
import { _generateLobbyTrack } from './tracks'

export const generateRelatedTrack = action({
  args: {
    artist: v.string()
  },
  async handler(_, { artist }) {
    // can make _generateLobbyTrack a util that doesn't take a Doc<"artists"> entirely
    return await _generateLobbyTrack(
      [{ name: artist, playerId: 'playerId' } as Doc<'artists'>],
      getLastFmSdk(),
      getSpotifySdk()
    )
  }
})
