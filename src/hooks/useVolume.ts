import { useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { getPlayerVolume, setPlayerVolume } from "../lib/playerStorage";

export function useVolume() {
  const defaultVolume = useMemo(() => getPlayerVolume() ?? 50, []);
  const audioRef = useRef<HTMLAudioElement>(null);

  function setVolume(newVolume: number) {
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  }

  function onVolumeChange(event: ChangeEvent<HTMLInputElement>) {
    const newVolume = Number(event.target.value);
    setPlayerVolume(newVolume);
    setVolume(newVolume);
  }

  useEffect(() => {
    setVolume(defaultVolume);
  }, [defaultVolume]);

  return { audioRef, defaultVolume, onVolumeChange };
}
