import type { Id } from "../../convex/_generated/dataModel";

const STORAGE_KEYS = {
  LOBBY_ID: "lobby-id",
  ID: "player-id",
  NAME: "player-name",
  ARTISTS: "player-artists",
  VOLUME: "player-volume",
};

function getOrNull<T>(key: string) {
  const item = localStorage.getItem(key);
  return item !== null ? (JSON.parse(item) as T) : null;
}
function set(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getLobbyId() {
  return getOrNull<Id<"lobbies">>(STORAGE_KEYS.LOBBY_ID);
}
export function setLobbyId(id: string) {
  set(STORAGE_KEYS.LOBBY_ID, id);
}

export function getPlayerId() {
  return getOrNull<Id<"players">>(STORAGE_KEYS.ID);
}
export function setPlayerId(id: string) {
  set(STORAGE_KEYS.ID, id);
}

export function getPlayerName() {
  return getOrNull<string>(STORAGE_KEYS.NAME);
}
export function setPlayerName(name: string) {
  set(STORAGE_KEYS.NAME, name);
}

type PlayerArtist = {
  spotifyId: string;
  name: string;
  genres: string[];
  years: number[];
};

export function getPlayerArtists() {
  return getOrNull<PlayerArtist[]>(STORAGE_KEYS.ARTISTS);
}
export function setPlayerArtists(artistGenres: PlayerArtist[]) {
  set(STORAGE_KEYS.ARTISTS, artistGenres);
}

export function getPlayerVolume() {
  return getOrNull<number>(STORAGE_KEYS.VOLUME);
}
export function setPlayerVolume(volume: number) {
  set(STORAGE_KEYS.VOLUME, volume);
}
