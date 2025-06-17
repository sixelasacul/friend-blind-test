import { v } from "convex/values";
import { customAction, customCtx } from "convex-helpers/server/customFunctions";
import { SpotifyApi, Track } from "@spotify/web-api-ts-sdk";
import * as cheerio from "cheerio";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { SONGS_TO_GENERATE } from "./lobbies";

/*
Some artists don't have a genre aassociated to them, for unknown reasons. Spotify
may remove the genres in the future, thus we'd need a different platform to retrieve
genre from artists. Not sure if this will affect the search as well. As an
alternative, last.fm could be used. But still, we'll need to still reach out to
Spotify to get the tracks and play them.
ref: https://community.spotify.com/t5/Spotify-for-Developers/Get-Artist-API-is-not-returning-any-or-all-Genres/td-p/6880841
*/

const MARKET = "FR";
const POPULARITY_THRESHOLD = 50;

function getSpotifySdk() {
  return SpotifyApi.withClientCredentials(
    process.env.SPOTIFY_CLIENT_ID!,
    process.env.SPOTIFY_CLIENT_SECRET!
  );
}

const spotifyAction = customAction(
  action,
  customCtx(() => {
    return { spotify: getSpotifySdk() };
  })
);
const spotifyInternalAction = customAction(
  internalAction,
  customCtx(() => {
    return { spotify: getSpotifySdk() };
  })
);

export const searchArtist = spotifyAction({
  args: { query: v.string() },
  async handler(ctx, { query }) {
    // not great to lock the market to FR, but meh that's fine for now
    const result = await ctx.spotify.search(query, ["artist"], MARKET, 5);
    return result.artists.items;
  },
});

function randomNumber(minInclusive: number, maxExclusive: number) {
  const minCeiled = Math.ceil(minInclusive);
  const maxFloored = Math.floor(maxExclusive);
  return Math.floor(Math.random() * (maxFloored - minCeiled)) + minCeiled;
}

function pickRandomIndices(maxExclusive: number, length: number) {
  const indices: number[] = [];
  // should be a param?
  const allowDuplicates = maxExclusive <= length;

  while (indices.length < length) {
    const randomIndex = randomNumber(0, maxExclusive);
    if (allowDuplicates || !indices.includes(randomIndex)) {
      indices.push(randomIndex);
    }
  }

  return indices;
}

async function getRelatedSong(spotify: SpotifyApi, artists: Doc<"artists">[]) {
  const artist = artists[randomNumber(0, artists.length)];

  const [originalArtist, artistsResult] = await Promise.all([
    spotify.artists.get(artist.spotifyId),
    // might add artist genres in the search later
    spotify.search(artist.name, ["artist"], MARKET),
  ]);
  const relatedArtists = artistsResult.artists.items.filter((resultArtist) => {
    // the original artist may not returned by the API, so we ensure it is not,
    // and always add it later
    const isOriginalArtist = resultArtist.id === originalArtist.id;
    const matchesGenres = originalArtist.genres.some((genre) =>
      resultArtist.genres.includes(genre)
    );
    // at least the artist should meet the threshold, but if the original artist
    // is below it, it is used as the threshold
    const matchesPopularity =
      resultArtist.popularity >=
      Math.min(POPULARITY_THRESHOLD, originalArtist.popularity);

    return !isOriginalArtist && matchesGenres && matchesPopularity;
  });

  console.log({
    originalArtist: originalArtist.name,
    relatedArtists: relatedArtists.map((a) => a.name),
  });

  // adds the original artist before picking, so that it doesn't have the meet
  // the popularity requirements
  const randomRelatedArtist =
    relatedArtists.concat(originalArtist)[
      randomNumber(0, relatedArtists.length)
    ];
  const tracksResult = await spotify.artists.topTracks(
    randomRelatedArtist.id,
    "FR"
  );

  return tracksResult.tracks[randomNumber(0, tracksResult.tracks.length)];
}

// inspired by https://github.com/lakshay007/spot
async function getPreviewUrl(track: Track) {
  const response = await fetch(track.external_urls.spotify);
  if (!response.ok)
    throw new Error(
      `Could not access track page: ${track.id} (${response.statusText})`
    );

  const html = await response.text();
  const $ = cheerio.load(html);

  return $('meta[property="og:audio"]').attr("content");
}

const FEATURING_REGEX = /\(*(?:feat\.|ft\.|featuring) [\w\s]+\)*$/i;
function removeFeaturings(trackName: string) {
  // search doesn't care about capturing groups
  const featIndex = trackName.search(FEATURING_REGEX);

  // some titles starts with featuring (weird but hey who am I to judge)
  if (featIndex <= 0) return trackName;

  return trackName.substring(0, featIndex).trim();
}

export const fetchSongs = spotifyInternalAction({
  args: { lobbyId: v.id("lobbies") },
  async handler(ctx, { lobbyId }) {
    // can be a parameter of the lobby
    const artists = await ctx.runQuery(internal.lobbies.getGameArtists, {
      lobbyId,
    });

    // perhaps instead of picking through players, we could first flatten the
    // player artists array, and pick from this. Though, it could lead into
    // some players not having their selection picked.
    const pickedPlayerIndices = pickRandomIndices(
      artists.length,
      SONGS_TO_GENERATE
    );

    const tracks = await Promise.all(
      pickedPlayerIndices.map(async (playerIndex, index) => {
        const currentPlayerArtists = artists[playerIndex];

        const track = await getRelatedSong(ctx.spotify, currentPlayerArtists);

        // for now we'll pretend that every track has a preview URL
        // later (and if that's not the case), we can add a while loop
        // to try with a different related song
        // (that can also be used to avoid duplicate songs)
        const previewUrl = (await getPreviewUrl(track))!;

        return {
          lobbyId,
          playerId: currentPlayerArtists[0].playerId,
          order: index,
          previewUrl,
          name: removeFeaturings(track.name),
          artists: track.artists.map(({ name }) => name),
        };
      })
    );

    await ctx.runMutation(internal.lobbies.addSongs, {
      tracks,
    });
  },
});

// depending on the precision, it may include the month and the day, but we don't need it
const YEAR_REGEX = /^(\d{4})/;
export const getArtistYear = spotifyInternalAction({
  args: { spotifyArtistId: v.string(), artistId: v.id("artists") },
  async handler(ctx, { spotifyArtistId, artistId }) {
    const maxLimit = 50;
    // rather than getting all (most) of their albums, I can get the 10 most
    // popular ones, which will give a range of when they were the most popular?
    // well not possible to sort them by popularity
    const result = await ctx.spotify.artists.albums(
      spotifyArtistId,
      // EPs are listed as singles, but then a lot of singles are returned
      // that's not worth doing multiple request
      "album",
      MARKET,
      maxLimit
    );

    if (result.total > maxLimit) {
      // should likely not happen but I want to monitor it
      console.warn(
        "More than the default limit of albums found",
        spotifyArtistId
      );
    }

    const releaseDates = result.items.map((album) => {
      const matches = album.release_date.match(YEAR_REGEX);

      if (matches === null)
        throw new Error(`No year found for album: ${album.name}`);

      return parseInt(matches[0]);
    });

    const years = [Math.min(...releaseDates), Math.max(...releaseDates)];

    await ctx.runMutation(internal.players.updateArtistYears, {
      artistId,
      years,
    });
  },
});

// https://open.spotify.com/album/6byLgsCduNbHLp62kORHs4?si=uRn3nDCHRZOyMFaMstK6uA
