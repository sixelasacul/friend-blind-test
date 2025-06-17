import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState } from "react";
import type { Artist } from "@spotify/web-api-ts-sdk";
import { setPlayerArtists } from "../../lib/playerStorage";
import { useDebounce } from "../../lib/useDebounce";
import { useGameInfo } from "../../hooks/useGameInfo";

export const Route = createFileRoute("/$lobbyId/waiting")({
  component: RouteComponent,
});

function ArtistSearch() {
  const { playerId } = Route.useRouteContext();
  useQuery(api.players.getPlayerInfo, { playerId });
  return null;
}

function PlayerInfo() {
  const { playerId } = Route.useRouteContext();
  useQuery(api.players.getPlayerInfo, { playerId });
  return null;
}

function RouteComponent() {
  const { playerId } = Route.useRouteContext();

  const playerInfo = useQuery(api.players.getPlayerInfo, { playerId });
  const gameInfo = useGameInfo();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const searchArtist = useAction(api.spotify.searchArtist);
  const [results, setResults] = useState<Artist[]>([]);

  const saveArtist = useMutation(api.players.saveArtist);
  const removeArtist = useMutation(api.players.removeArtist);
  const ready = useMutation(api.players.ready);

  useEffect(() => {
    if (debouncedSearch !== "") {
      searchArtist({ query: debouncedSearch }).then((res) => setResults(res));
    } else {
      setResults([]);
    }
  }, [debouncedSearch, searchArtist]);

  useEffect(() => {
    if (playerInfo) {
      setPlayerArtists(
        playerInfo.artists.map((artist) => {
          const { genres, name, spotifyId, years } = artist;
          return {
            genres,
            name,
            spotifyId,
            years,
          };
        })
      );
    }
  }, [playerInfo]);

  async function saveArtistAndReset({ id, name, genres }: Artist) {
    await saveArtist({ playerId, artist: { spotifyId: id, name, genres } });
    setResults([]);
    setSearch("");
  }

  return (
    <>
      {gameInfo?.game.status === "loading" && <h3>The game will start!</h3>}
      <button onClick={() => ready({ playerId })}>Ready</button>
      <h2>Artists</h2>
      {playerInfo && (
        <ul>
          {playerInfo.artists.map((artist) => (
            <li key={artist._id}>
              {artist.name}, {artist.genres.join(", ")} ({artist.years})
              <button onClick={() => removeArtist({ artistId: artist._id })}>
                X
              </button>
            </li>
          ))}
        </ul>
      )}
      <label>
        Search more artists
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={(playerInfo?.artists.length ?? 0) >= 5}
        />
      </label>
      <ul>
        {results.map((result) => (
          <li key={result.id}>
            <button onClick={() => saveArtistAndReset(result)}>
              {result.name}, {result.genres.join(", ")}
            </button>
          </li>
        ))}
      </ul>
      <PlayerInfo />
      <ArtistSearch />
    </>
  );
}
