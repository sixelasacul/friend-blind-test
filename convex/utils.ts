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

// I used to generate all answers before the round starts, but that wouldn't
// handle players joining mid round
async function getOrInsertAnswer(
  ctx: MutationCtx,
  playerId: Id<"players">,
  trackId: Id<"tracks">
) {
  const answer = await ctx.db
    .query("answers")
    .withIndex("by_player_and_track", (q) =>
      q.eq("playerId", playerId).eq("trackId", trackId)
    )
    .unique();

  if (answer !== null) return answer;

  const _id = await ctx.db.insert("answers", {
    playerId: playerId,
    trackId: trackId,
    partialAnswer: "",
  });

  // no need to retrieve the answer with id since we have insert data right above
  return {
    _id,
    _creationTime: Date.now(),
    playerId: playerId,
    trackId: trackId,
    partialAnswer: "",
  } satisfies Doc<"answers">;
}

export async function prepareAnswerContext(
  ctx: MutationCtx,
  playerId: Id<"players">,
  lobbyId: Id<"lobbies">
) {
  const [{ currentTrackId }, player] = await Promise.all([
    getOrThrow(ctx.db.get(lobbyId), `Game not found ${lobbyId}`),
    getOrThrow(ctx.db.get(playerId), `Player not found ${playerId}`),
  ]);

  if (!currentTrackId)
    throw new Error(`No track currently playing in lobby: ${lobbyId}`);

  const [answer, currentTrack] = await Promise.all([
    getOrInsertAnswer(ctx, playerId, currentTrackId),
    getOrThrow(
      ctx.db.get(currentTrackId),
      `Track not found: ${currentTrackId}`
    ),
  ]);

  return { player, answer, currentTrack };
}
