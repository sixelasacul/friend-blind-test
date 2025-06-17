import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const createLobby = useMutation(api.lobbies.create);

  async function createLobbyThenRedirect() {
    const lobbyId = await createLobby();
    navigate({
      to: "/$lobbyId",
      params: { lobbyId },
    });
  }

  return <button onClick={createLobbyThenRedirect}>Create a lobby</button>;
}
