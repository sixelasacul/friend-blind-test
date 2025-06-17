import { v } from "convex/values";
import { distance } from "fastest-levenshtein";
import { mutation, query } from "./_generated/server";
import { getAnswerContext, getOrThrow } from "./utils";

// maximum distance to count as correct, based on levenshtein distance
// 1 means 1 character difference
const CORRECT_TERM_THRESHOLD = 1;
// maximum percentage of correct terms needed for an answer
const CORRECT_OVERALL_THRESHOLD = 0.8;

const SCORING = {
  PLAYER: 5,
  TRACK: 5,
  ARTISTS: 5,
};

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

  const hasCorrectTrack =
    trackScore / preparedTrack.length >= CORRECT_OVERALL_THRESHOLD;
  const hasCorrectArtists =
    artistScore / preparedArtists.length >= CORRECT_OVERALL_THRESHOLD;

  return {
    partialAnswer: [...correctTermsFromAnswer].join(" "),
    hasCorrectTrack,
    hasCorrectArtists,
  };
}

function getNewScore(
  currentScore: number,
  hasCorrectTrack: boolean,
  hasCorrectArtists: boolean
) {
  let newScore = currentScore;
  if (hasCorrectTrack) newScore += SCORING.TRACK;
  if (hasCorrectArtists) newScore += SCORING.ARTISTS;
  return newScore;
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
    const timestamp = Date.now();
    const { answer, currentTrack, player } = await getAnswerContext(
      ctx,
      playerId,
      lobbyId
    );

    const {
      _id,
      hadCorrectTrackNameAt,
      hadCorrectArtistsAt,
      partialAnswer: prevPartialAnswer,
    } = answer;

    if (hadCorrectArtistsAt && hadCorrectTrackNameAt)
      throw new Error("Answer already found");

    const { hasCorrectArtists, hasCorrectTrack, partialAnswer } = checkAnswer(
      answerText,
      prevPartialAnswer,
      currentTrack.name,
      currentTrack.artists
    );

    const shouldUpdateScore =
      (hasCorrectTrack && !hadCorrectTrackNameAt) ||
      (hasCorrectArtists && !hadCorrectArtistsAt);
    const newHadCorrectTrackNameAt =
      hadCorrectTrackNameAt || (hasCorrectTrack ? timestamp : undefined);
    const newHadCorrectArtistsAt =
      hadCorrectArtistsAt || (hasCorrectArtists ? timestamp : undefined);

    await Promise.all([
      ctx.db.patch(_id, {
        hadCorrectTrackNameAt: newHadCorrectTrackNameAt,
        hadCorrectArtistsAt: newHadCorrectArtistsAt,
        partialAnswer,
      }),
      shouldUpdateScore &&
        ctx.db.patch(playerId, {
          score: getNewScore(player.score, hasCorrectTrack, hasCorrectArtists),
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
    const { answer, currentTrack, player } = await getAnswerContext(
      ctx,
      playerId,
      lobbyId
    );

    if (answer.guessedPlayerId) {
      throw new Error("You already guess a player for this track");
    }

    const hasCorrectPlayer = guessedPlayerId === currentTrack.playerId;

    if (hasCorrectPlayer && !answer.hadCorrectPlayerAt) {
      await Promise.all([
        ctx.db.patch(answer._id, {
          guessedPlayerId,
          hadCorrectPlayerAt: hasCorrectPlayer ? timestamp : undefined,
        }),
        // perhaps instead of having the score persisted, it can be computed from
        // answers. That way, it may be easier to adjust points based on speed
        ctx.db.patch(playerId, {
          score: player.score + SCORING.PLAYER,
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

    const { hadCorrectTrackNameAt, hadCorrectArtistsAt, hadCorrectPlayerAt } =
      (await ctx.db
        .query("answers")
        .withIndex("by_player_and_track", (q) =>
          q.eq("playerId", playerId).eq("trackId", currentTrackId)
        )
        .unique()) ?? {};

    return { hadCorrectTrackNameAt, hadCorrectArtistsAt, hadCorrectPlayerAt };
  },
});
