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
      artist: (Artist & WithImage)[];
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
        limit,
      },
    });

    return results.artistmatches.artist;
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

export class LastFmApi {
  public artist: LastFmArtistApi;

  constructor(apiKey: string) {
    this.artist = new LastFmArtistApi(apiKey);
  }
}
