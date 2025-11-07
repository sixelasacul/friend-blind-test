import { pino } from "pino";
import { v } from "convex/values";
import { getLastFmSdk, lastFmInternalAction } from "./lastFm";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  getPreviewUrl,
  getTrackPreviewDuration,
  pickRandomIndices,
  randomNumber,
  removeFeaturings,
} from "./tracks.utils";
import { SONGS_TO_GENERATE } from "./lobbies";
import { Doc, Id } from "./_generated/dataModel";
import { LastFmApi } from "./lastFmApi";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { getSpotifySdk } from "./spotify";

const logger = pino({
  level: "debug",
});

// for some reason, Spotify returns preview with duration of either 30s (approx. 29s)
// and 17 seconds. For now, we don't want to use shorter ones. Later we may use them
// all, we'd have to accommodate the scheduled functions.
const MIN_DURATION = 28; // seconds

export async function _generateLobbyTrack(
  currentPlayerArtists: Doc<"artists">[],
  lastFmApi: LastFmApi,
  spotifyApi: SpotifyApi,
) {
  // should not continue if `currentPlayerArtists` is empty

  const artistIndex = randomNumber(0, currentPlayerArtists.length);
  const artist = currentPlayerArtists[artistIndex];

  const contextLogger = logger.child({
    originalArtist: artist.name,
    playerId: artist.playerId,
  });

  const playerArtistsToRetry = currentPlayerArtists.toSpliced(artistIndex, 1);

  const relatedArtists = (await lastFmApi.artist.getSimilar(artist.name))
    .map(({ name }) => name)
    .concat(artist.name);
  const pickedArtist = relatedArtists[randomNumber(0, relatedArtists.length)];
  contextLogger.debug({ pickedArtist });

  const topTracks = await lastFmApi.artist.getTopTracks(pickedArtist);
  const pickedTrack = topTracks[randomNumber(0, topTracks.length)];
  contextLogger.debug({ pickedTrack: pickedTrack.name });

  // NOTE: If we detect non ascii characters in the title (after we sanitize it)
  // like in the answers, then we skip and get another track

  // Probably fine to not remove them here, but it could be done when
  // checking answers (+ remove "radio edit", "remix" + remove part, pt)
  const sanitizedTrack = removeFeaturings(pickedTrack.name);
  const results = await spotifyApi.search(
    `artist:"${pickedTrack.artist.name}" track:"${sanitizedTrack}"`,
    ["track"],
    "FR",
    1,
  );
  const spotifyTrack = results.tracks.items[0];
  contextLogger.debug({ spotifyResults: results.tracks.items.length });

  if (results.tracks.items.length === 0) {
    contextLogger.debug("Not found in Spotify");
    return _generateLobbyTrack(playerArtistsToRetry, lastFmApi, spotifyApi);
  }

  // LastFM artists associated to tracks and albums are weird, e.g.
  // Pretty DollCorpse are 3 albums, one with only Ptite Soeur, one with
  // Ptite Soeur, Neophron, FEMTOGO, but they are grouped as one artist.
  // Spotify is more accurate for this, so picking from this
  const artists = spotifyTrack.artists.map(({ name }) => name);

  const previewUrl = await getPreviewUrl(spotifyTrack);
  contextLogger.debug({ previewUrl });

  if (!previewUrl) {
    contextLogger.debug("Cannot retrieve preview URL");
    return _generateLobbyTrack(playerArtistsToRetry, lastFmApi, spotifyApi);
  }

  const duration = (await getTrackPreviewDuration(previewUrl)) ?? 0;
  contextLogger.debug({ duration });

  if (duration < MIN_DURATION) {
    contextLogger.debug("Preview is shorted than expected");
    return _generateLobbyTrack(playerArtistsToRetry, lastFmApi, spotifyApi);
  }

  contextLogger.debug("Worked");

  return {
    playerId: artist.playerId,
    previewUrl,
    name: removeFeaturings(pickedTrack.name),
    artists: artists,
  };
}

async function _generateLobbyTracks(
  lobbyId: Id<"lobbies">,
  gameArtists: Doc<"artists">[][],
  lastFmApi: LastFmApi,
  spotifyApi: SpotifyApi,
) {
  // perhaps instead of picking through players, we could first flatten the
  // player artists array, and pick from this. Though, it could lead into
  // some players not having their selection picked.
  // Probably fine, especially since I may add later random songs not tied
  // to specific player to spice things up
  const pickedPlayerIndices = pickRandomIndices(
    gameArtists.length,
    SONGS_TO_GENERATE,
  );

  // TODO: Use allSettled (perhaps eslint rule for this?)
  const tracks = await Promise.all(
    pickedPlayerIndices.map(async (playerIndex, index) => {
      const currentPlayerArtists = gameArtists[playerIndex];

      return {
        ...(await _generateLobbyTrack(
          currentPlayerArtists,
          lastFmApi,
          spotifyApi,
        )),
        lobbyId,
        order: index,
      };
    }),
  );

  return tracks;
}

export const getArtistTopTracks = lastFmInternalAction({
  args: { query: v.string() },
  async handler(ctx, { query }) {
    return await ctx.lastFm.artist.getTopTracks(query);
  },
});

export const generateLobbyTracks = internalAction({
  args: { lobbyId: v.id("lobbies") },
  async handler(ctx, { lobbyId }) {
    const artists = await ctx.runQuery(internal.lobbies.getGameArtists, {
      lobbyId,
    });

    const tracks = await _generateLobbyTracks(
      lobbyId,
      artists,
      getLastFmSdk(),
      getSpotifySdk(),
    );

    await ctx.runMutation(internal.lobbies.addSongs, {
      tracks,
    });
  },
});
