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

// for some reason, Spotify returns preview with duration of either 30s (approx. 29s)
// and 17 seconds. For now, we don't want to use shorter ones. Later we may use them
// all, we'd have to accommodate the scheduled functions.
const MIN_DURATION = 28; // seconds

export async function _generateLobbyTrack(
  currentPlayerArtists: Doc<"artists">[],
  lastFmApi: LastFmApi,
  spotifyApi: SpotifyApi,
) {
  const artist =
    currentPlayerArtists[randomNumber(0, currentPlayerArtists.length)];

  const relatedArtists = (await lastFmApi.artist.getSimilar(artist.name))
    .map(({ name }) => name)
    .concat(artist.name);
  const pickedArtist = relatedArtists[randomNumber(0, relatedArtists.length)];

  const topTracks = await lastFmApi.artist.getTopTracks(pickedArtist);
  const pickedTrack = topTracks[randomNumber(0, topTracks.length)];

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
  console.log(
    `artist:"${pickedTrack.artist.name}" track:"${sanitizedTrack}"`,
    results.tracks.items,
  );
  // LastFM artists associated to tracks and albums are weird, e.g.
  // Pretty DollCorpse are 3 albums, one with only Ptite Soeur, one with
  // Ptite Soeur, Neophron, FEMTOGO, but they are grouped as one artist.
  // Spotify is more accurate for this, so picking from this
  const artists = spotifyTrack.artists.map(({ name }) => name);

  const previewUrl = await getPreviewUrl(spotifyTrack);

  // 1. should have logger so that we can debug and figure out which ones fail
  // 2. should have a ban list to avoid retrying the same ones (even though unlikely)
  // 2.1. simple set passed to next call
  // 3. could have a retry on the preview?
  if (!previewUrl) {
    return _generateLobbyTrack(currentPlayerArtists, lastFmApi, spotifyApi);
  }

  const duration = (await getTrackPreviewDuration(previewUrl)) ?? 0;

  if (duration < MIN_DURATION) {
    return _generateLobbyTrack(currentPlayerArtists, lastFmApi, spotifyApi);
  }

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
