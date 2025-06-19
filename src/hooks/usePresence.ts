import { useConvex, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { getRouteApi } from "@tanstack/react-router";

const HEARTBEAT = 10_000;

const Route = getRouteApi("/$lobbyId");

export function usePresence() {
  const { playerId } = Route.useRouteContext();
  const convex = useConvex();
  const updatePresence = useMutation(api.presence.updatePresence);
  const [shouldStop, setShouldStop] = useState(false);

  useEffect(() => {
    // when switching `shouldStop` it should run the clean up function and clear
    // the interval by itself
    if (shouldStop) return;

    // should only be called once, right after shouldStop is set to false
    updatePresence({ playerId, online: true });

    const interval = setInterval(() => {
      updatePresence({ playerId, online: true });
    }, HEARTBEAT);

    return () => clearInterval(interval);
  }, [shouldStop, playerId, updatePresence]);

  // we don't immediately mark the player offline, but stop the interval so that
  // it will run into the timeout server side and disconnect them. At least, it
  // should take 10 seconds, which simple `alt+tab`s.
  useEffect(() => {
    function handleHeartbeat() {
      setShouldStop(document.visibilityState === "hidden");
    }

    document.addEventListener("visibilitychange", handleHeartbeat);

    return () =>
      document.removeEventListener("visibilitychange", handleHeartbeat);
  }, []);

  useEffect(() => {
    function disconnect() {
      // sendBeacon is blocked by tracking blocker extensions, the alternative
      // is to use fetch with keepalive: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
      fetch(`${convex.url}/api/mutation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "presence:updatePresence",
          args: { playerId, online: false },
        }),
        keepalive: true,
      });
    }

    window.addEventListener("beforeunload", disconnect);

    return () => window.removeEventListener("beforeunload", disconnect);
  }, [playerId, updatePresence, convex]);
}
