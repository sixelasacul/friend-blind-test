import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useGameInfo } from "../../hooks/useGameInfo";
import { api } from "../../../convex/_generated/api";
import { useVolume } from "../../hooks/useVolume";
import { Volume } from "../../components/Volume";

export const Route = createFileRoute("/$lobbyId/playing")({
  component: RouteComponent,
});

// https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
function RouteComponent() {
  const { lobbyId, playerId } = Route.useRouteContext();
  const gameInfo = useGameInfo();

  const { audioRef, defaultVolume, onVolumeChange } = useVolume();

  // when someone joins after the music has started, sync the audio with the others
  useEffect(() => {
    const diff = Date.now() - (gameInfo?.game.startedTrackAt ?? Date.now());
    if (audioRef.current) {
      if (diff > 1_000) {
        audioRef.current.currentTime = diff / 1000;
      }
      audioRef.current.play();
    }
  }, [audioRef, gameInfo?.game.startedTrackAt]);

  const guessPlayer = useMutation(api.answers.guessPlayer);

  const [answerText, setAnswerText] = useState("");
  const guessTrackNameAndArtists = useMutation(
    api.answers.guessTrackNameAndArtists
  );
  const answer = useQuery(api.answers.getPlayerAnswer, { lobbyId, playerId });
  // if answer.partialAnswer gets longer after `guessTrackNameAndArtists`, we
  // can notify the player

  if (!gameInfo || !answer) {
    return <p>Loading</p>;
  }

  const { currentGameTrackUrl, previousTracks, players } = gameInfo;
  const { hadCorrectTrackNameAt, hadCorrectArtistsAt, hadCorrectPlayerAt } =
    answer;

  return (
    <>
      <audio ref={audioRef} src={currentGameTrackUrl} />
      {/* would be nice to have this in the waiting route without duplication
      (putting it in the layout, but that means I don't have access to the audio
      element, so should I move it up too??)
      I guess I could do an overall Audio component that handles everything? */}
      <Volume defaultVolume={defaultVolume} onVolumeChange={onVolumeChange} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          // or perhaps use withOptimistic?
          guessTrackNameAndArtists({ answerText, lobbyId, playerId }).then(() =>
            setAnswerText("")
          );
        }}
      >
        <label>
          Guess the track name and artists
          <input
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
          />
        </label>
        <button type="submit">Guess</button>
      </form>

      {hadCorrectTrackNameAt && <p>Guess track name</p>}
      {hadCorrectArtistsAt && <p>Guess artists</p>}
      {hadCorrectPlayerAt && <p>Guess player</p>}

      <ul>
        {players.map((player) => (
          <li key={player._id}>
            <button
              onClick={() =>
                guessPlayer({ playerId, lobbyId, guessedPlayerId: player._id })
              }
            >
              Vote
            </button>
            <p>
              <span>{player.name}</span> (<span>{player.score}</span>)
              {player.hadCorrectTrackNameAt && <span>Guess track name</span>}
              {player.hadCorrectArtistsAt && <span>Guess artists</span>}
              {player.hadCorrectPlayerAt && <span>Guess player</span>}
            </p>
          </li>
        ))}
      </ul>

      <ul>
        {previousTracks.map((track) => (
          <li key={track._id}>
            {track.name} - {track.artists.join(", ")} (from {track.player})
          </li>
        ))}
      </ul>
    </>
  );
}
