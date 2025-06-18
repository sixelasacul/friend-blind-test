import { useConvex, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const HEARTBEAT = 10_000;

export function usePresence(playerId: Id<"players">) {
  const convex = useConvex();
  const updatePresence = useMutation(api.presence.updatePresence);

  useEffect(() => {
    const interval = setInterval(() => {
      updatePresence({ playerId, online: true });
    }, HEARTBEAT);

    // may clear the interval on focus loss after some delay, so that if someone
    // forgets to close the page, the lobby is not blocked

    return () => clearInterval(interval);
  }, [playerId, updatePresence]);

  useEffect(() => {
    function disconnect() {
      const blob = new Blob([
        JSON.stringify({
          path: "presence:updatePresence",
          args: { playerId, online: false },
        }),
      ]);
      navigator.sendBeacon(`${convex.url}/api/mutation`, blob);
    }

    window.addEventListener("beforeunload", disconnect);

    return () => window.removeEventListener("beforeunload", disconnect);
  }, [playerId, updatePresence, convex]);
}
