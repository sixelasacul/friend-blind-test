import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  getLobbyId,
  getPlayerArtists,
  getPlayerId,
  getPlayerName,
  setLobbyId,
  setPlayerId,
  setPlayerName,
} from "../../lib/playerStorage";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { STATUS_TO_ROUTE_MAP } from "../../hooks/useGameInfo";
import { usePresence } from "../../hooks/usePresence";

export const Route = createFileRoute("/$lobbyId")({
  component: RouteComponent,
  async beforeLoad({ context, params, matches }) {
    const lobbyId = params.lobbyId as Id<"lobbies">;

    const gameInfo = await context.convexHttpClient.query(
      api.lobbies.getGameInfo,
      {
        lobbyId,
      }
    );

    // Join the lobby if not already, and save artists to the lobby

    let playerId = getPlayerId();
    const savedLobbyId = getLobbyId();
    const name = getPlayerName() ?? undefined;
    const savedArtists = getPlayerArtists();

    if (playerId === null || savedLobbyId !== lobbyId) {
      const newPlayerId = await context.convexHttpClient.mutation(
        api.lobbies.join,
        {
          lobbyId,
          name,
        }
      );

      // shouldn't be an issue if someone joins while the game is running since the
      // songs are generated
      if (savedArtists) {
        context.convexHttpClient.mutation(api.players.saveArtists, {
          playerId: newPlayerId,
          artists: savedArtists,
        });
      }

      setPlayerId(newPlayerId);
      setLobbyId(lobbyId);
      playerId = newPlayerId;
    }

    // Redirects to the proper route based on the game status

    // the longest route parsed from pathname
    const lastMatches = matches.at(-1)!;

    const route = STATUS_TO_ROUTE_MAP[gameInfo.game.status];
    if (lastMatches.fullPath !== route) {
      throw redirect({
        to: route,
        params: {
          lobbyId,
        },
      });
    }

    return {
      playerId,
      // also exposed via useParams, but we don't repeat the typing
      lobbyId,
    };
  },
});

// should show player name + edit
function RouteComponent() {
  usePresence();
  const { playerId, lobbyId } = Route.useRouteContext();

  const playerInfo = useQuery(api.players.getPlayerInfo, { playerId });

  const [name, setName] = useState("");
  const updateName = useMutation(api.players.updateName);

  useEffect(() => {
    if (playerInfo) {
      setName(playerInfo.player.name);
      setPlayerName(playerInfo.player.name);
    }
  }, [playerInfo]);

  return (
    <>
      <div className="flex flex-row justify-between">
        <h1>Lobby ID: {lobbyId}</h1>
        <div>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={() => updateName({ playerId, name })}>
            Save name
          </button>
        </div>
      </div>
      <Outlet />
    </>
  );
}
