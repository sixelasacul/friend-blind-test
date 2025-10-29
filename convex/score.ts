const SCORING = {
  PLAYER: 5,
  TRACK: 5,
  ARTISTS: 5,
};
const PLAYER_TRACK_MALUS = 1;
const MAX_POINT_SPEED = 3;

export function computeScore(
  isPlayerTrack: boolean,
  guessedTrack: boolean,
  guessedArtists: boolean,
  guessedPlayer: boolean,
  /** 0 is first */
  answerPosition: number,
) {
  let score = 0;
  const malus = isPlayerTrack ? PLAYER_TRACK_MALUS : 0;
  if (guessedTrack) score += SCORING.TRACK - malus;
  if (guessedArtists) score += SCORING.ARTISTS - malus;
  if (guessedPlayer) score += SCORING.PLAYER - malus;

  if (guessedTrack && guessedArtists)
    score += Math.max(MAX_POINT_SPEED - answerPosition, 0);

  return score;
}
