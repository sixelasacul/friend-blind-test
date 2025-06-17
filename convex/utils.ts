import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export type GenericCtx = QueryCtx | MutationCtx;

export async function getOrThrow<T>(
  promise: Promise<T | null>,
  errorMessage: string
) {
  const entity = await promise;

  if (entity === null) throw new Error(errorMessage);

  return entity;
}

export function getPlayers(ctx: GenericCtx, lobbyId: Id<"lobbies">) {
  return ctx.db
    .query("players")
    .withIndex("by_lobby", (q) => q.eq("lobbyId", lobbyId))
    .collect();
}

export async function getTrack(ctx: GenericCtx, game: Doc<"lobbies">) {
  return game.currentTrackId ? await ctx.db.get(game.currentTrackId) : null;
}

export async function getAnswerContext(
  ctx: GenericCtx,
  playerId: Id<"players">,
  lobbyId: Id<"lobbies">
) {
  const [{ currentTrackId }, player] = await Promise.all([
    getOrThrow(ctx.db.get(lobbyId), "Game not found"),
    getOrThrow(ctx.db.get(playerId), "Player not found"),
  ]);

  if (!currentTrackId)
    throw new Error(`No track currently playing in lobby: ${lobbyId}`);

  const [answer, currentTrack] = await Promise.all([
    ctx.db
      .query("answers")
      .withIndex("by_player_and_track", (q) =>
        q.eq("playerId", playerId).eq("trackId", currentTrackId)
      )
      .first(),
    ctx.db.get(currentTrackId),
  ]);

  if (!answer)
    throw new Error(`No answer row for player: ${playerId} (${lobbyId})`);
  if (!currentTrack) throw new Error(`Track not found: ${currentTrackId}`);

  return { player, answer, currentTrack };
}
