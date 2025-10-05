import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getOrThrow, getPlayers, getTrack, GenericCtx } from "./utils";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

const TIME_BETWEEN_SONGS = 5_000;
const PREVIEW_SONG_DURATION = 30_000;
// later, that can be a lobby setting
export const SONGS_TO_GENERATE = 10;

function getTrackHistory(ctx: GenericCtx, lobbyId: Id<"lobbies">) {
  return (
    ctx.db
      .query("tracks")
      .withIndex("by_lobby_and_order", (q) => q.eq("lobbyId", lobbyId))
      // should take the last 10 results, even though previous songs will be removed
      .take(SONGS_TO_GENERATE)
  );
}

type PlayerWithAnswer = Doc<"players"> &
  Pick<
    Doc<"answers">,
    "hadCorrectArtistsAt" | "hadCorrectPlayerAt" | "hadCorrectTrackNameAt"
  >;

function getAllPlayerAnswers(
  ctx: GenericCtx,
  players: Doc<"players">[],
  trackId?: Id<"tracks">
): Promise<PlayerWithAnswer>[] {
  return players.map(async (player) => {
    if (!trackId) return player;

    const { hadCorrectTrackNameAt, hadCorrectArtistsAt, hadCorrectPlayerAt } =
      (await ctx.db
        .query("answers")
        .withIndex("by_player_and_track", (q) =>
          q.eq("playerId", player._id).eq("trackId", trackId)
        )
        .order("desc")
        .unique()) ?? {};

    return {
      ...player,
      hadCorrectTrackNameAt,
      hadCorrectArtistsAt,
      hadCorrectPlayerAt,
    };
  });
}

export const getGameInfo = query({
  args: { lobbyId: v.id("lobbies") },
  async handler(ctx, { lobbyId }) {
    const [game, players] = await Promise.all([
      getOrThrow(ctx.db.get(lobbyId), "Game not found"),
      getPlayers(ctx, lobbyId),
    ]);

    const [currentGameTrack, allTracks, ...playersWithAnswer] =
      await Promise.all([
        getTrack(ctx, game),
        getTrackHistory(ctx, game._id),
        ...getAllPlayerAnswers(ctx, players, game.currentTrackId),
      ]);

    const sortedPlayers = playersWithAnswer.sort(
      (first, second) => second.score - first.score
    );

    const previousTracks = allTracks
      .filter(
        (track) =>
          game.status === "finished" ||
          track.order < (currentGameTrack?.order ?? 0)
      )
      .map((track) => ({
        ...track,
        player: players.find((player) => player._id === track.playerId)!.name,
      }));

    return {
      game,
      players: sortedPlayers,
      currentGameTrackUrl: currentGameTrack?.previewUrl,
      previousTracks,
    };
  },
});

export const create = mutation({
  async handler(ctx) {
    return await ctx.db.insert("lobbies", {
      status: "waiting",
      currentTrackId: undefined,
      startedTrackAt: undefined,
    });
  },
});

export const join = mutation({
  args: { lobbyId: v.id("lobbies"), name: v.optional(v.string()) },
  async handler(ctx, { lobbyId, name }) {
    const players = await getPlayers(ctx, lobbyId);

    // that's arbitrary
    if (players.length >= 12) {
      throw new Error("Game is full");
    }

    const playerId = await ctx.db.insert("players", {
      lobbyId,
      name: name ?? "random",
      score: 0,
      ready: false,
      online: true,
    });

    ctx.scheduler.runAfter(0, api.presence.updatePresence, {
      playerId,
      online: true,
    });

    return playerId;
  },
});

export const prepareLobbyForStartIfPossible = internalMutation({
  args: { lobbyId: v.id("lobbies") },
  async handler(ctx, { lobbyId }) {
    const players = await getPlayers(ctx, lobbyId);
    const onlinePlayers = players.filter((player) => player.online);

    if (onlinePlayers.length < 2 || !onlinePlayers.every((p) => p.ready))
      return;

    const offlinePlayers = players.filter((player) => !player.online);

    await Promise.all([
      await ctx.db.patch(lobbyId, {
        status: "paused",
      }),
      ...offlinePlayers.map((player) => ctx.db.delete(player._id)),
    ]);

    // I want this to run immediately, even though the game may start later
    await ctx.scheduler.runAfter(0, internal.tracks.generateLobbyTracks, {
      lobbyId: lobbyId,
    });
  },
});

export const getGameArtists = internalQuery({
  args: { lobbyId: v.id("lobbies") },
  async handler(ctx, { lobbyId }) {
    const players = await getPlayers(ctx, lobbyId);
    // I think artists should have lobbyId as index
    const artists = await Promise.all(
      players.map((p) =>
        ctx.db
          .query("artists")
          .withIndex("by_player", (q) => q.eq("playerId", p._id))
          .collect()
      )
    );
    return artists;
  },
});

// i should remove the songs before adding new ones
export const addSongs = internalMutation({
  args: {
    tracks: v.array(
      v.object({
        lobbyId: v.id("lobbies"),
        playerId: v.id("players"),
        name: v.string(),
        artists: v.array(v.string()),
        previewUrl: v.string(),
        order: v.number(),
      })
    ),
  },
  async handler(ctx, { tracks }) {
    const lobbyId = tracks[0].lobbyId;

    const [firstTrackId] = await Promise.all(
      tracks.map((song) => ctx.db.insert("tracks", song))
    );

    ctx.scheduler.runAfter(TIME_BETWEEN_SONGS, internal.lobbies.startGame, {
      lobbyId,
      firstTrackId,
    });
  },
});

export const startGame = internalMutation({
  args: { lobbyId: v.id("lobbies"), firstTrackId: v.id("tracks") },
  async handler(ctx, { lobbyId, firstTrackId }) {
    await ctx.db.patch(lobbyId, {
      status: "playing",
      currentTrackId: firstTrackId,
      startedTrackAt: Date.now(),
    });

    ctx.scheduler.runAfter(1000, internal.players.resetReady, { lobbyId });

    ctx.scheduler.runAfter(
      PREVIEW_SONG_DURATION,
      internal.lobbies.prepareNextSong,
      { lobbyId, currentTrackId: firstTrackId }
    );
  },
});

export const prepareNextSong = internalMutation({
  args: { lobbyId: v.id("lobbies"), currentTrackId: v.id("tracks") },
  async handler(ctx, { lobbyId, currentTrackId }) {
    const currentSong = await ctx.db.get(currentTrackId);

    if (!currentSong) throw new Error(`Song does not exist: ${currentTrackId}`);

    const nextSong = await ctx.db
      .query("tracks")
      .withIndex("by_lobby_and_order", (q) =>
        q.eq("lobbyId", lobbyId).eq("order", currentSong.order + 1)
      )
      .first();

    if (!nextSong) {
      ctx.scheduler.runAfter(TIME_BETWEEN_SONGS, internal.lobbies.endGame, {
        lobbyId,
      });
      return;
    }

    await ctx.db.patch(lobbyId, {
      status: "paused",
      currentTrackId: nextSong._id,
    });

    ctx.scheduler.runAfter(TIME_BETWEEN_SONGS, internal.lobbies.startNextSong, {
      lobbyId,
      nextSongId: nextSong._id,
    });
  },
});

export const startNextSong = internalMutation({
  args: { lobbyId: v.id("lobbies"), nextSongId: v.id("tracks") },
  async handler(ctx, { lobbyId, nextSongId }) {
    await ctx.db.patch(lobbyId, {
      status: "playing",
      startedTrackAt: Date.now(),
    });

    ctx.scheduler.runAfter(
      PREVIEW_SONG_DURATION,
      internal.lobbies.prepareNextSong,
      { lobbyId, currentTrackId: nextSongId }
    );
  },
});

export const endGame = internalMutation({
  args: { lobbyId: v.id("lobbies") },
  async handler(ctx, { lobbyId }) {
    await ctx.db.patch(lobbyId, {
      status: "finished",
      currentTrackId: undefined,
      startedTrackAt: undefined,
    });
  },
});
