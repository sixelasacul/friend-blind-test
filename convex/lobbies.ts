import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  getOrThrow,
  getPlayers,
  getTrack,
  GenericCtx,
  getLobbyAnswers,
  preparePlayersWithScore,
  prepareTracksWithPlayerAnswers,
} from "./utils";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const TIME_BETWEEN_SONGS = 5_000;
const PREVIEW_SONG_DURATION = 30_000;
// later, that can be a lobby setting
export const SONGS_TO_GENERATE = 20;

function getTrackHistory(ctx: GenericCtx, lobbyId: Id<"lobbies">) {
  return (
    ctx.db
      .query("tracks")
      .withIndex("by_lobby_and_order", (q) => q.eq("lobbyId", lobbyId))
      // should take the last 10 results, even though previous songs will be removed
      .take(SONGS_TO_GENERATE)
  );
}

export const getGameInfo = query({
  args: { lobbyId: v.id("lobbies") },
  async handler(ctx, { lobbyId }) {
    const [game, players, answers] = await Promise.all([
      getOrThrow(ctx.db.get(lobbyId), "Game not found"),
      getPlayers(ctx, lobbyId),
      getLobbyAnswers(ctx, lobbyId),
    ]);

    const [currentGameTrack, allTracks] = await Promise.all([
      getTrack(ctx, game),
      getTrackHistory(ctx, game._id),
    ]);

    // both could be merged in a larger util to prepare all data for the game info
    // to reuse some structures (*ById)
    const preparedPlayers = preparePlayersWithScore(
      players,
      answers,
      allTracks,
      currentGameTrack,
    );

    const preparedTracks = prepareTracksWithPlayerAnswers(
      players,
      answers,
      allTracks,
    );
    // a bit op, will see to do it within preparedTracks
    const [prepareCurrentGameTrack] = currentGameTrack
      ? prepareTracksWithPlayerAnswers(players, answers, [currentGameTrack])
      : [null];

    const previousTracks = preparedTracks.filter(
      (track) =>
        game.status === "finished" ||
        track.order < (currentGameTrack?.order ?? 0),
    );

    const { _id, previewUrl, playerAnswers } = prepareCurrentGameTrack ?? {};

    return {
      game,
      players: preparedPlayers,
      // obfuscated to not reveal answers in network
      currentGameTrack: {
        _id,
        previewUrl,
        // should be in players I think, it would be easier to use on frontend
        playerAnswers,
      },
      previousTracks,
    };
  },
});

export const create = mutation({
  args: {},
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

    // that's arbitrary, but could be a lobby setting?
    if (players.length >= 12) {
      throw new Error("Game is full");
    }

    const playerId = await ctx.db.insert("players", {
      lobbyId,
      // use package `unique-names-generator`
      name: name ?? "random",
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

    // bypass during dev to start the game with only one player
    // const onlinePlayers = players.filter((player) => player.online);
    // if (onlinePlayers.length < 2 || !onlinePlayers.every((p) => p.ready))
    //   return;

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
          .collect(),
      ),
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
      }),
    ),
  },
  async handler(ctx, { tracks }) {
    const lobbyId = tracks[0].lobbyId;

    const [firstTrackId] = await Promise.all(
      tracks.map((song) => ctx.db.insert("tracks", song)),
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
      { lobbyId, currentTrackId: firstTrackId },
    );
  },
});

export const prepareNextSong = internalMutation({
  args: { lobbyId: v.id("lobbies"), currentTrackId: v.id("tracks") },
  async handler(ctx, { lobbyId, currentTrackId }) {
    console.log("prepareNextSong");
    const currentSong = await ctx.db.get(currentTrackId);

    if (!currentSong) throw new Error(`Song does not exist: ${currentTrackId}`);

    const nextSong = await ctx.db
      .query("tracks")
      .withIndex("by_lobby_and_order", (q) =>
        q.eq("lobbyId", lobbyId).eq("order", currentSong.order + 1),
      )
      .first();

    // we pause first even when game ends to prevent audio from playing again
    // if the route changed didn't occur before
    await ctx.db.patch(lobbyId, {
      status: "paused",
      currentTrackId: nextSong?._id ?? undefined,
    });
    console.log("paused");

    if (!nextSong) {
      ctx.scheduler.runAfter(TIME_BETWEEN_SONGS, internal.lobbies.endGame, {
        lobbyId,
      });
      return;
    }

    ctx.scheduler.runAfter(TIME_BETWEEN_SONGS, internal.lobbies.startNextSong, {
      lobbyId,
      nextSongId: nextSong._id,
    });
  },
});

export const startNextSong = internalMutation({
  args: { lobbyId: v.id("lobbies"), nextSongId: v.id("tracks") },
  async handler(ctx, { lobbyId, nextSongId }) {
    console.log("startNextSong");
    await ctx.db.patch(lobbyId, {
      status: "playing",
      startedTrackAt: Date.now(),
    });
    console.log("playing");

    ctx.scheduler.runAfter(
      PREVIEW_SONG_DURATION,
      internal.lobbies.prepareNextSong,
      { lobbyId, currentTrackId: nextSongId },
    );
  },
});

export const endGame = internalMutation({
  args: { lobbyId: v.id("lobbies") },
  async handler(ctx, { lobbyId }) {
    console.log("endGame");
    await ctx.db.patch(lobbyId, {
      status: "finished",
      currentTrackId: undefined,
      startedTrackAt: undefined,
    });
  },
});
