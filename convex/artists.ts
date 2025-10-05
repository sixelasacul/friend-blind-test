import { v } from "convex/values";
import { lastFmAction, lastFmInternalAction } from "./lastFm";

export const search = lastFmAction({
  args: { query: v.string() },
  async handler(ctx, { query }) {
    return await ctx.lastFm.artist.search(query);
  },
});

export const getSimilarArtists = lastFmInternalAction({
  args: { query: v.string() },
  async handler(ctx, { query }) {
    return await ctx.lastFm.artist.getSimilar(query);
  },
});
