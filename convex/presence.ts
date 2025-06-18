import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { api } from "./_generated/api";

const TIMEOUT = 20_000;

// inspired by Convex's presence component: https://www.convex.dev/components/presence
// and blog post: https://www.convex.dev/components/presence
// but they don't fit my app

export const updatePresence = mutation({
  args: {
    playerId: v.id("players"),
    online: v.boolean(),
  },
  async handler(ctx, { playerId, online }) {
    const player = await ctx.db.get(playerId);
    if (!player) throw new Error(`Player not found ${playerId}`);

    if (online) {
      if (player.timeoutFn) {
        await ctx.scheduler.cancel(player.timeoutFn);
      }

      const timeoutFn = await ctx.scheduler.runAfter(
        TIMEOUT,
        api.presence.updatePresence,
        { playerId, online: false }
      );

      await ctx.db.patch(playerId, { online, timeoutFn });
      return;
    }

    await ctx.db.patch(playerId, { online, timeoutFn: undefined });
  },
});
