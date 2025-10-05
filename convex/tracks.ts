import { v } from "convex/values";
import { getLastFmSdk, lastFmInternalAction } from "./lastFm";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  getPreviewUrl,
  pickRandomIndices,
  randomNumber,
  removeFeaturings,
} from "./tracks.utils";
import { SONGS_TO_GENERATE } from "./lobbies";
import { Doc, Id } from "./_generated/dataModel";
import { LastFmApi } from "./lastFmApi";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { getSpotifySdk } from "./spotify";

async function _generateLobbyTracks(
  lobbyId: Id<"lobbies">,
  gameArtists: Doc<"artists">[][],
  lastFmApi: LastFmApi,
  spotifyApi: SpotifyApi
) {
  // perhaps instead of picking through players, we could first flatten the
  // player artists array, and pick from this. Though, it could lead into
  // some players not having their selection picked.
  // Probably fine, especially since I may add later random songs not tied
  // to specific player to spice things up
  const pickedPlayerIndices = pickRandomIndices(
    gameArtists.length,
    SONGS_TO_GENERATE
  );

  // TODO: Use allSettled (perhaps eslint rule for this?)
  const tracks = await Promise.all(
    pickedPlayerIndices.map(async (playerIndex, index) => {
      const currentPlayerArtists = gameArtists[playerIndex];
      const artist =
        currentPlayerArtists[randomNumber(0, currentPlayerArtists.length)];

      const relatedArtists = (await lastFmApi.artist.getSimilar(artist.name))
        .map(({ name }) => name)
        .concat(artist.name);
      const pickedArtist =
        relatedArtists[randomNumber(0, relatedArtists.length)];

      const topTracks = await lastFmApi.artist.getTopTracks(pickedArtist);
      const pickedTrack = topTracks[randomNumber(0, topTracks.length)];

      const sanitizedTrack = removeFeaturings(pickedTrack.name);
      const results = await spotifyApi.search(
        `artist:"${pickedTrack.artist.name}" track:"${sanitizedTrack}"`,
        ["track"],
        "FR",
        1
      );
      const spotifyTrack = results.tracks.items[0];

      console.log({
        originalArtist: artist,
        relatedArtists: relatedArtists.join(", "),
        pickedTrack: pickedTrack.name,
        spotifyTrackName: spotifyTrack.name,
        spotifyTrackArtists: spotifyTrack.artists
          .map(({ name }) => name)
          .join(", "),
      });

      // for now we'll pretend that every track has a preview URL
      // later (and if that's not the case), we can add a while loop
      // to try with a different related song
      // (that can also be used to avoid duplicate songs)
      const previewUrl = (await getPreviewUrl(spotifyTrack))!;

      return {
        lobbyId,
        playerId: currentPlayerArtists[0].playerId,
        order: index,
        previewUrl,
        name: removeFeaturings(spotifyTrack.name),
        artists: spotifyTrack.artists.map(({ name }) => name),
      };
    })
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
      getSpotifySdk()
    );

    await ctx.runMutation(internal.lobbies.addSongs, {
      tracks,
    });
  },
});
