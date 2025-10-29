import { v } from "convex/values";
import { distance } from "fastest-levenshtein";
import { mutation, query } from "./_generated/server";
import { prepareAnswerContext, getOrThrow } from "./utils";

// maximum distance to count as correct, based on levenshtein distance
// 1 means 1 character difference
const CORRECT_TERM_THRESHOLD = 1;
// maximum percentage of correct terms needed for an answer
const CORRECT_OVERALL_THRESHOLD = 0.8;

// can include (or via another function) transformations like "R" <-> "are",
// "4" <-> "for", "$" <-> "s"
// or within checkParts, or a special prepare function for answers, so that we
// inject aliases in the answer parts to be checked
// might remove numbers as well from the title to make things easier (and changing
// difficulty to not remove them)
function prepare(str: string) {
  return (
    str
      .toLowerCase()
      .normalize("NFD")
      // note: instead of multiple replace, could be a single replace with different regexes?
      .replace(/\p{Diacritic}/gu, "")
      // just can't get enough -> just cant get enough
      .replace(/[']/g, "")
      // champs-élysées -> champs elysees
      .replace(/[-_]/g, " ")
      // fallback for the rest of special characters, like M|O|O|N -> MOON
      .replace(/[^\w\s\d]/g, "")
      .split(" ")
  );
}

function checkParts(
  answerPart: string,
  toMatch: string[],
  // mutable
  matchedParts: Set<string>,
) {
  return toMatch.some((part) => {
    if (matchedParts.has(part)) return false;

    const match = distance(part, answerPart) <= CORRECT_TERM_THRESHOLD;
    if (!match) return false;

    matchedParts.add(part);
    return match;
  });
}

function checkAnswer(
  answerText: string,
  partialAnswer: string,
  track: string,
  artists: string[],
) {
  // Note: Take word length in account to validate correctness of the answer
  // Perhaps ignore words of less than 2 letters
  const preparedTrack = prepare(track);
  const preparedArtists = artists.map(prepare);
  const preparedPartialAnswer = prepare(partialAnswer);
  const preparedAnswer = prepare(answerText).concat(preparedPartialAnswer);

  let trackScore = 0;
  let artistScores = Array.from<number>({ length: artists.length }).fill(0);
  const correctTermsFromAnswer = new Set<string>(preparedPartialAnswer);
  const matchedParts = new Set<string>();

  // could be optimized I guess; once something has been matched, it shouldn't be checked again
  // perhaps having some kind of Map indexed by part, with answer part as value
  // or mutating prepared* to remove what has been matched (in a different variable
  // to not mess up the threshold check)
  for (const answerPart of preparedAnswer) {
    const trackMatch = checkParts(answerPart, preparedTrack, matchedParts);
    const artistMatches = preparedArtists.map((artist) =>
      checkParts(answerPart, artist, matchedParts),
    );

    if (trackMatch || artistMatches.some(Boolean)) {
      correctTermsFromAnswer.add(answerPart);
    }

    artistScores = artistMatches.map(
      (match, index) => (artistScores[index] += match ? 1 : 0),
    );
    trackScore += trackMatch ? 1 : 0;
  }

  const guessedTrack =
    trackScore / preparedTrack.length >= CORRECT_OVERALL_THRESHOLD;
  // if at least one of the artists is passes the threshold, we can consider it's guessed
  // note: based on lobby difficulty, we could make this check stricter (.every)
  const guessedArtists = artistScores.some(
    (artistScore, index) =>
      artistScore / preparedArtists[index].length >= CORRECT_OVERALL_THRESHOLD,
  );

  return {
    partialAnswer: [...correctTermsFromAnswer].join(" "),
    guessedTrack,
    guessedArtists,
  };
}

export const guessTrackNameAndArtists = mutation({
  args: {
    playerId: v.id("players"),
    lobbyId: v.id("lobbies"),
    answerText: v.string(),
  },
  async handler(ctx, { playerId, lobbyId, answerText }) {
    // even if it's validated later, so that "race to first" doesn't take server
    // tasks in account
    const timestamp = Date.now();

    const { answer, currentTrack } = await prepareAnswerContext(
      ctx,
      playerId,
      lobbyId,
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
      currentTrack.artists,
    );

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
      lobbyId,
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
      "Game not found",
    );

    if (!currentTrackId) {
      return {};
    }

    const { guessedTrackNameAt, guessedArtistsAt, guessedPlayerAt } =
      (await ctx.db
        .query("answers")
        .withIndex("by_player_and_track", (q) =>
          q.eq("playerId", playerId).eq("trackId", currentTrackId),
        )
        .unique()) ?? {};

    return { guessedTrackNameAt, guessedArtistsAt, guessedPlayerAt };
  },
});
