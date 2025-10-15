import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { computeScore } from "./score";

export type GenericCtx = QueryCtx | MutationCtx;

// TODO:
// create smaller util files based on entities, like `answers.utils.ts`

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

export async function getLobbyAnswers(ctx: GenericCtx, lobbyId: Id<"lobbies">) {
  return ctx.db
    .query("answers")
    .withIndex("by_lobby", (q) => q.eq("lobbyId", lobbyId))
    .collect();
}

// like Object.groupBy, but each key should have a unique value, e.g. indexed by id
export function arrayToRecord<T, K extends PropertyKey>(
  array: T[],
  keySelector: (item: T) => K
): Record<K, T> {
  return array.reduce<Record<K, T>>((acc, item) => {
    acc[keySelector(item)] = item;
    return acc;
  }, {} as Record<K, T>);
}

type PlayerWithAnswerAndScore = Doc<"players"> &
  Pick<
    Doc<"answers">,
    "guessedArtistsAt" | "guessedPlayerAt" | "guessedTrackNameAt"
  > & { score: number };

export function preparePlayersWithScore(
  players: Doc<"players">[],
  answers: Doc<"answers">[],
  tracks: Doc<"tracks">[]
): PlayerWithAnswerAndScore[] {
  // Indexes tracks by id in one loop so that answers don't loop through it on each
  // iteration to find the related track
  const tracksById = arrayToRecord(tracks, (track) => track._id);

  // sorts the answers to rank the correct and quickest ones first
  // it's not yet based on track
  const sortedAnswers = answers.toSorted((first, second) => {
    if (!first.guessedArtistsAt || !first.guessedTrackNameAt) return 1;
    if (!second.guessedArtistsAt || !second.guessedTrackNameAt) return -1;

    return (
      Math.max(first.guessedArtistsAt, first.guessedTrackNameAt) -
      Math.max(second.guessedArtistsAt, second.guessedTrackNameAt)
    );
  });

  // Indexes track answers by player id in one loop so that answers don't loop
  // through it on each iteration to find the related track
  // it also attaches the track and the position on each answer (since answers
  // are sorted)
  const trackAnswersByPlayerId = sortedAnswers.reduce<
    Record<
      Id<"players">,
      Array<Doc<"answers"> & { track: Doc<"tracks">; position: number }>
    >
  >((acc, trackAnswer) => {
    const prevTrackAnswers = acc[trackAnswer.playerId] ?? [];
    acc[trackAnswer.playerId] = prevTrackAnswers.concat({
      ...trackAnswer,
      // they are inserted by order, and since they are sorted, the first one
      // will have position 0, second one 1, etc.
      position: prevTrackAnswers.length,
      track: tracksById[trackAnswer.trackId],
    });
    return acc;
  }, {});

  return players
    .map((player) => {
      // a player may not have answer yet at any point of the game
      const trackAnswers = trackAnswersByPlayerId[player._id] ?? [];

      const score = trackAnswers.reduce((acc, answer) => {
        const answerScore = computeScore(
          answer.track?.playerId === player._id,
          !!answer.guessedTrackNameAt,
          !!answer.guessedArtistsAt,
          !!answer.guessedPlayerAt,
          answer.position
        );

        return acc + answerScore;
      }, 0);

      return {
        ...player,
        // will have to figure out how to return all this info for each player
        // and each track, to build up the history, while still having the current
        // track?
        // not a fan but that would make more sense to have these in here, for the UI
        // guessedArtistsAt,
        // guessedPlayerAt,
        // guessedTrackNameAt,
        score,
      };
    })
    .toSorted((first, second) => second.score - first.score);
}

export function prepareTracksWithPlayerAnswers(
  players: Doc<"players">[],
  answers: Doc<"answers">[],
  tracks: Doc<"tracks">[]
) {
  const playersById = arrayToRecord(players, (player) => player._id);
  const answersByTrackId = Object.groupBy(answers, (answer) => answer.trackId);

  return tracks.map((track) => {
    const sourcePlayer = playersById[track.playerId];
    const answers = answersByTrackId[track._id] ?? [];

    const playerAnswers = answers.map(
      ({ playerId, guessedArtistsAt, guessedPlayerAt, guessedTrackNameAt }) => {
        const player = playersById[playerId];
        return {
          ...player,
          guessedArtistsAt,
          guessedPlayerAt,
          guessedTrackNameAt,
        };
      }
    );
    return {
      ...track,
      playerAnswers,
      sourcePlayer,
    };
  });
}

// I used to generate all answers before the round starts, but that wouldn't
// handle players joining mid round
async function getOrInsertAnswer(
  ctx: MutationCtx,
  lobbyId: Id<"lobbies">,
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
    lobbyId,
    playerId,
    trackId,
    partialAnswer: "",
  });

  // no need to retrieve the answer with id since we have insert data right above
  return {
    _id,
    _creationTime: Date.now(),
    lobbyId,
    playerId,
    trackId,
    partialAnswer: "",
  } satisfies Doc<"answers">;
}

export async function prepareAnswerContext(
  ctx: MutationCtx,
  playerId: Id<"players">,
  lobbyId: Id<"lobbies">
) {
  const { currentTrackId } = await getOrThrow(
    ctx.db.get(lobbyId),
    `Game not found ${lobbyId}`
  );

  if (!currentTrackId)
    throw new Error(`No track currently playing in lobby: ${lobbyId}`);

  const [answer, currentTrack] = await Promise.all([
    getOrInsertAnswer(ctx, lobbyId, playerId, currentTrackId),
    getOrThrow(
      ctx.db.get(currentTrackId),
      `Track not found: ${currentTrackId}`
    ),
  ]);

  return { answer, currentTrack };
}
