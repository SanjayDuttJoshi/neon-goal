const NAME_KEY = "neon-goal:name";
const CLIENT_ID_KEY = "neon-goal:client-id";
const MUTED_KEY = "neon-goal:muted";
const TUTORIAL_KEY = "neon-goal:tutorial-seen";
const ACTIVE_ROOM_KEY = "neon-goal:active-room";

const safeGet = (storage: () => Storage, key: string): string | null => {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (storage: () => Storage, key: string, value: string): void => {
  try {
    storage().setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the game still works.
  }
};

const local = (): Storage => window.localStorage;
const session = (): Storage => window.sessionStorage;

const randomId = (): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

let memoryClientId: string | null = null;

/** Stable per tab so a refresh can reclaim the same player slot. */
export const getClientId = (): string => {
  const stored = safeGet(session, CLIENT_ID_KEY);
  if (stored) return stored;
  memoryClientId ??= randomId();
  safeSet(session, CLIENT_ID_KEY, memoryClientId);
  return memoryClientId;
};

export const getSavedName = (): string => safeGet(local, NAME_KEY) ?? "";
export const saveName = (name: string): void => safeSet(local, NAME_KEY, name);

export const getMuted = (): boolean => safeGet(local, MUTED_KEY) === "1";
export const saveMuted = (muted: boolean): void => safeSet(local, MUTED_KEY, muted ? "1" : "0");

export const getTutorialSeen = (): boolean => safeGet(local, TUTORIAL_KEY) === "1";
export const saveTutorialSeen = (): void => safeSet(local, TUTORIAL_KEY, "1");

/** Room this tab is currently in, so a refresh drops the player straight back into it. */
export const getActiveRoom = (): string => safeGet(session, ACTIVE_ROOM_KEY) ?? "";
export const saveActiveRoom = (code: string | null): void => {
  if (code) safeSet(session, ACTIVE_ROOM_KEY, code);
  else {
    try {
      session().removeItem(ACTIVE_ROOM_KEY);
    } catch {
      // Ignore: nothing to clear when storage is blocked.
    }
  }
};

const NAME_FIRST = ["Turbo", "Neon", "Bijli", "Rocket", "Pixel", "Toofan", "Cyber", "Chhota"];
const NAME_LAST = ["Tiger", "Bheem", "Ninja", "Cheetah", "Baaz", "Raja", "Sher", "Golu"];

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export const randomGuestName = (): string => `${pick(NAME_FIRST)} ${pick(NAME_LAST)}`;
