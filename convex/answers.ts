import { v } from "convex/values";
import { distance } from "fastest-levenshtein";
import { mutation, query } from "./_generated/server";
import { prepareAnswerContext, getOrThrow } from "./utils";

// maximum distance to count as correct, based on levenshtein distance
// 1 means 1 character difference
const CORRECT_TERM_THRESHOLD = 1;
// maximum percentage of correct terms needed for an answer
const CORRECT_OVERALL_THRESHOLD = 0.8;

function prepare(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w\s]/, "")
    .split(" ");
}

function checkParts(
  answerPart: string,
  toMatch: string[],
  // mutable
  alreadyMatchParts: Set<string>
) {
  return toMatch.some((part) => {
    if (alreadyMatchParts.has(part)) return false;

    const match = distance(part, answerPart) <= CORRECT_TERM_THRESHOLD;
    if (!match) return false;

    alreadyMatchParts.add(part);
    return match;
  });
}

function checkAnswer(
  answerText: string,
  partialAnswer: string,
  track: string,
  artists: string[]
) {
  const preparedTrack = prepare(track);
  const preparedArtists = prepare(artists.join(" "));
  const preparedPartialAnswer = prepare(partialAnswer);
  const preparedAnswer = prepare(answerText).concat(preparedPartialAnswer);

  let trackScore = 0;
  let artistScore = 0;
  const correctTermsFromAnswer = new Set<string>(preparedPartialAnswer);
  const matchedTrackParts = new Set<string>();
  const matchedArtistParts = new Set<string>();

  for (const answerPart of preparedAnswer) {
    const trackMatch = checkParts(answerPart, preparedTrack, matchedTrackParts);
    const artistMatch = checkParts(
      answerPart,
      preparedArtists,
      matchedArtistParts
    );

    if (artistMatch || trackMatch) {
      correctTermsFromAnswer.add(answerPart);
    }

    artistScore += artistMatch ? 1 : 0;
    trackScore += trackMatch ? 1 : 0;
  }

  const guessedTrack =
    trackScore / preparedTrack.length >= CORRECT_OVERALL_THRESHOLD;
  const guessedArtists =
    artistScore / preparedArtists.length >= CORRECT_OVERALL_THRESHOLD;

  return {
    partialAnswer: [...correctTermsFromAnswer].join(" "),
    guessedTrack,
    guessedArtists,
  };
}

// Note: Take word length in account to validate correctness of the answer
// Perhaps ignore words of less than 2 letters
export const guessTrackNameAndArtists = mutation({
  args: {
    playerId: v.id("players"),
    lobbyId: v.id("lobbies"),
    answerText: v.string(),
  },
  async handler(ctx, { playerId, lobbyId, answerText }) {
    const { answer, currentTrack } = await prepareAnswerContext(
      ctx,
      playerId,
      lobbyId
    );

    const {
      _id,
      guessedTrackNameAt,
      guessedArtistsAt,
      partialAnswer: prevPartialAnswer,
    } = answer;

    if (guessedArtistsAt && guessedTrackNameAt)
      throw new Error("Answer already found");

    const { guessedArtists, guessedTrack, partialAnswer } = checkAnswer(
      answerText,
      prevPartialAnswer,
      currentTrack.name,
      currentTrack.artists
    );

    const timestamp = Date.now();

    await Promise.all([
      ctx.db.patch(_id, {
        // we update the timestamps only if it wasn't guessed before
        guessedTrackNameAt:
          guessedTrackNameAt ?? (guessedTrack ? timestamp : undefined),
        guessedArtistsAt:
          guessedArtistsAt ?? (guessedArtists ? timestamp : undefined),
        partialAnswer,
      }),
    ]);
  },
});

export const guessPlayer = mutation({
  args: {
    playerId: v.id("players"),
    lobbyId: v.id("lobbies"),
    guessedPlayerId: v.id("players"),
  },
  async handler(ctx, { playerId, lobbyId, guessedPlayerId }) {
    const timestamp = Date.now();
    const { answer, currentTrack } = await prepareAnswerContext(
      ctx,
      playerId,
      lobbyId
    );

    if (answer.guessedPlayerId) {
      throw new Error("You already guess a player for this track");
    }

    const hasCorrectPlayer = guessedPlayerId === currentTrack.playerId;

    if (hasCorrectPlayer && !answer.guessedPlayerAt) {
      await Promise.all([
        ctx.db.patch(answer._id, {
          guessedPlayerId,
          guessedPlayerAt: hasCorrectPlayer ? timestamp : undefined,
        }),
      ]);
    }
  },
});

export const getPlayerAnswer = query({
  args: {
    playerId: v.id("players"),
    lobbyId: v.id("lobbies"),
  },
  async handler(ctx, { playerId, lobbyId }) {
    const { currentTrackId } = await getOrThrow(
      ctx.db.get(lobbyId),
      "Game not found"
    );

    if (!currentTrackId) {
      return {};
    }

    const { guessedTrackNameAt, guessedArtistsAt, guessedPlayerAt } =
      (await ctx.db
        .query("answers")
        .withIndex("by_player_and_track", (q) =>
          q.eq("playerId", playerId).eq("trackId", currentTrackId)
        )
        .unique()) ?? {};

    return { guessedTrackNameAt, guessedArtistsAt, guessedPlayerAt };
  },
});
