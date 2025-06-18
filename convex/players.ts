import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getPlayers } from "./utils";

export const getPlayerInfo = query({
  args: {
    playerId: v.id("players"),
  },
  async handler(ctx, { playerId }) {
    const [player, artists] = await Promise.all([
      ctx.db.get(playerId),
      ctx.db
        .query("artists")
        .withIndex("by_player", (q) => q.eq("playerId", playerId))
        .collect(),
    ]);

    if (player === null) {
      throw new Error("Player not found");
    }

    return { player, artists };
  },
});

export const ready = mutation({
  args: { playerId: v.id("players") },
  async handler(ctx, { playerId }) {
    const player = await ctx.db.get(playerId);

    if (!player) throw new Error("Player not in the room");

    if (player.ready) {
      return await ctx.db.patch(playerId, {
        ready: false,
      });
    }

    // should check there's enough artists for that player
    await ctx.db.patch(playerId, {
      ready: true,
    });

    const lobbyId = player.lobbyId;

    const players = await getPlayers(ctx, lobbyId);

    const onlinePlayers = players.filter((player) => player.online);

    if (onlinePlayers.length < 2 || !onlinePlayers.every((p) => p.ready))
      return;

    const offlinePlayers = players.filter((player) => !player.online);

    await Promise.all([
      await ctx.db.patch(player.lobbyId, {
        status: "paused",
      }),
      ...offlinePlayers.map((player) => ctx.db.delete(player._id)),
    ]);

    // I want this to run immediately, even though the game may start later
    await ctx.scheduler.runAfter(0, internal.spotify.fetchSongs, {
      lobbyId: player.lobbyId,
    });
  },
});

export const resetReady = internalMutation({
  args: { lobbyId: v.id("lobbies") },
  async handler(ctx, { lobbyId }) {
    const players = await getPlayers(ctx, lobbyId);
    await Promise.all(
      players.map((player) => ctx.db.patch(player._id, { ready: false }))
    );
  },
});

export const updateName = mutation({
  args: { playerId: v.id("players"), name: v.string() },
  async handler(ctx, { playerId, name }) {
    return await ctx.db.patch(playerId, {
      name,
    });
  },
});

const artistSchema = v.object({
  spotifyId: v.string(),
  name: v.string(),
  genres: v.array(v.string()),
  years: v.optional(v.array(v.number())),
});

export const saveArtist = mutation({
  args: {
    playerId: v.id("players"),
    artist: artistSchema,
  },
  async handler(ctx, { playerId, artist }) {
    const { spotifyId, name, genres, years } = artist;
    // should re-validate via spotify? That'd be more calls but safer
    // anyway, the selected artists should be persisted either client side
    // or server side to be re-used across games (prob client side)
    const artists = await ctx.db
      .query("artists")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .collect();

    if (artists.length >= 5) {
      // do not fail, but won't accept more
      return;
    }

    const areYearsValid = years?.length === 2;

    const artistId = await ctx.db.insert("artists", {
      playerId,
      spotifyId,
      name,
      genres,
      years: areYearsValid ? years : [],
    });

    if (!areYearsValid) {
      ctx.scheduler.runAfter(0, internal.spotify.getArtistYear, {
        spotifyArtistId: spotifyId,
        artistId,
      });
    }

    return artistId;
  },
});

export const saveArtists = mutation({
  args: {
    playerId: v.id("players"),
    artists: v.array(artistSchema),
  },
  async handler(ctx, { playerId, artists }) {
    await Promise.all(
      artists.map((artist) =>
        ctx.runMutation(api.players.saveArtist, { playerId, artist })
      )
    );
  },
});

export const updateArtistYears = internalMutation({
  args: {
    artistId: v.id("artists"),
    years: v.array(v.number()),
  },
  async handler(ctx, { artistId, years }) {
    return await ctx.db.patch(artistId, { years });
  },
});

export const removeArtist = mutation({
  args: {
    artistId: v.id("artists"),
  },
  async handler(ctx, { artistId }) {
    return await ctx.db.delete(artistId);
  },
});
