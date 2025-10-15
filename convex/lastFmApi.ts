import { $Fetch, ofetch } from "ofetch";

type Image = {
  "#text": string;
  size: string;
};

type Artist = {
  name: string;
  mbid: string;
  match: number;
  url: string;
};

type Track = {
  name: string;
  playcount: number;
  listeners: number;
  url: string;
  artist: Artist;
};

type WithImage = {
  image: Image[];
};

type WithListeners = {
  listeners: number;
};

// TODO: perhaps rewrite the LastFm response to have more consistent structure?
// - no resulsts on Search artists
// - artist plural
// - camel case
type SimilarArtists = {
  similarartists: {
    artist: (Artist & WithImage)[];
  };
};

type SearchArtists = {
  results: {
    artistmatches: {
      artist: (Artist & WithImage & WithListeners)[];
    };
  };
};

type ArtistTopTracks = {
  toptracks: {
    track: (Track & WithImage)[];
  };
};

class LastFmBaseApi {
  protected fetch: $Fetch;

  constructor(apiKey: string) {
    this.fetch = ofetch.create({
      baseURL: "http://ws.audioscrobbler.com/2.0/",
      params: {
        api_key: apiKey,
      },
    });
  }
}

class LastFmArtistApi extends LastFmBaseApi {
  private static LISTENERS_THRESHOLD = 1_000;

  private static filterByListeners(artist: WithListeners) {
    return artist.listeners >= LastFmArtistApi.LISTENERS_THRESHOLD;
  }
  private static sortByListeners(
    firstArtist: WithListeners,
    secondArtist: WithListeners
  ) {
    return secondArtist.listeners - firstArtist.listeners;
  }

  async getSimilar(artist: string, limit = 10) {
    const { similarartists } = await this.fetch<SimilarArtists>("", {
      params: {
        method: "artist.getSimilar",
        format: "json",
        artist,
        limit,
      },
    });

    return similarartists.artist;
  }

  async search(artist: string, limit = 5) {
    const { results } = await this.fetch<SearchArtists>("", {
      params: {
        method: "artist.search",
        format: "json",
        artist,
        // we retrieve more in case we have to filter out some results
        limit: limit * 2,
      },
    });

    const filteredArtists = results.artistmatches.artist.filter(
      LastFmArtistApi.filterByListeners
    );

    return filteredArtists.slice(0, limit);
  }

  async getTopTracks(artist: string, limit = 10) {
    const { toptracks } = await this.fetch<ArtistTopTracks>("", {
      params: {
        method: "artist.getTopTracks",
        format: "json",
        artist,
        limit,
      },
    });

    return toptracks.track;
  }
}

// TODO: Look more info MusicBrainz, which seems to be used by LastFM for their database:
// https://beta.musicbrainz.org/doc/MusicBrainz_API
// Could use the genre database from there
// Could even download their database to use it directly within convex and save
// some API calls (but can't find the size (6GB)).
// though I don't think I'll have the similar artists.

export class LastFmApi {
  public artist: LastFmArtistApi;

  constructor(apiKey: string) {
    this.artist = new LastFmArtistApi(apiKey);
  }
}
