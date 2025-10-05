import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// future notes:
// - allow to log in with spotify
// - competitive??

export default defineSchema({
  lobbies: defineTable({
    status: v.union(
      // waiting for people to join and be ready
      v.literal("waiting"),
      // state in which every one is ready and it's generating songs to be played
      v.literal("loading"),
      // transition state between rounds, in which no action should be done (ready/guess)
      // should always have a track id associated
      v.literal("paused"),
      // should always have a track id associated
      v.literal("playing"),
      v.literal("finished")
    ),
    currentTrackId: v.optional(v.id("tracks")),
    startedTrackAt: v.optional(v.number()),
    // settings idea:
    // strict: no leeway for the answers
    // how many songs
    // difficulty: lower the popularity threshold and fetch not top tracks (not sure how with the API)
    // mode:
    // - pick from players' artists
    // - top songs from top genres (like generic blind tests)
    // - pick/ban (no ban) from top genres
  }),

  players: defineTable({
    lobbyId: v.id("lobbies"),
    name: v.string(),
    ready: v.boolean(),
    score: v.number(),
    online: v.boolean(),
    timeoutFn: v.optional(v.id("_scheduled_functions")),
  }).index("by_lobby", ["lobbyId"]),

  artists: defineTable({
    playerId: v.id("players"),
    externalId: v.string(),
    // may want to remove these in the future if they aren't needed anymore
    name: v.string(),
  }).index("by_player", ["playerId"]),

  tracks: defineTable({
    lobbyId: v.id("lobbies"),
    playerId: v.id("players"),
    name: v.string(),
    /** May change to only the main artist */
    artists: v.array(v.string()),
    previewUrl: v.string(),
    order: v.number(),
  }).index("by_lobby_and_order", ["lobbyId", "order"]),

  answers: defineTable({
    playerId: v.id("players"),
    trackId: v.id("tracks"),
    // we'd only save part of the answers that are correct and discard the rest
    partialAnswer: v.string(),
    // can make only one guess
    guessedPlayerId: v.optional(v.id("players")),
    // if set, player guessed correctly
    hadCorrectArtistsAt: v.optional(v.number()),
    hadCorrectTrackNameAt: v.optional(v.number()),
    hadCorrectPlayerAt: v.optional(v.number()),
  }).index("by_player_and_track", ["playerId", "trackId"]),
});
