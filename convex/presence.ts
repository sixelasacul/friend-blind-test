import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import { mutation } from './_generated/server'

const TIMEOUT = 20_000

// inspired by Convex's presence component: https://www.convex.dev/components/presence
// and blog post: https://www.convex.dev/components/presence
// but they don't fit my app

export const updatePresence = mutation({
  args: {
    playerId: v.id('players'),
    online: v.boolean()
  },
  async handler(ctx, { playerId, online }) {
    const player = await ctx.db.get(playerId)
    if (!player) throw new Error(`Player not found ${playerId}`)

    if (online) {
      if (player.timeoutFn) {
        await ctx.scheduler.cancel(player.timeoutFn)
      }

      const timeoutFn = await ctx.scheduler.runAfter(
        TIMEOUT,
        api.presence.updatePresence,
        { playerId, online: false }
      )

      await ctx.db.patch(playerId, { online, timeoutFn })
      return
    }

    await ctx.db.patch(playerId, { online, timeoutFn: undefined })

    // if everyone online is ready and someone left, we want to start the game
    ctx.scheduler.runAfter(0, internal.lobbies.prepareLobbyForStartIfPossible, {
      lobbyId: player.lobbyId
    })
  }
})
