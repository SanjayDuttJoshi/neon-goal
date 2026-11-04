import { GameEventKind, GameMode, type GameEvent, type RosterEntry } from "@/types/game";
import type { FeedItem } from "@/types/render";
import { TEAM_NAMES } from "@/game/constants";

const MAX_FEED = 5;

const nameOf = (roster: RosterEntry[], id: string): string => roster.find((r) => r.id === id)?.name ?? "Koi";

/** Converts notable game events into short feed lines for the HUD. */
export const describeEvent = (event: GameEvent, roster: RosterEntry[], mode: GameMode): string | null => {
  switch (event.kind) {
    case GameEventKind.Goal: {
      const who = nameOf(roster, event.playerId);
      if (event.otherId === "own") return `${who} ka OWN GOAL! 🤦`;
      if (mode === GameMode.FreeForAll) return `${who} ne GOAL maara! 🔥`;
      return `GOAL! ${who} (${TEAM_NAMES[event.team] ?? ""}) ⚡`;
    }
    case GameEventKind.Save:
      return `Kya bachaya ${nameOf(roster, event.playerId)} ne! 🧤`;
    case GameEventKind.Eliminated:
      return `${TEAM_NAMES[event.team] ?? "Team"} bahar ho gaya ❌`;
    case GameEventKind.Overtime:
      return "GOLDEN GOAL! Agla goal jeetega 🏆";
    case GameEventKind.PowerBounce:
      return event.value > 1100 ? `${nameOf(roster, event.playerId)} ka POWER SHOT 💥` : null;
    default:
      return null;
  }
};

export const appendFeed = (feed: FeedItem[], item: FeedItem): FeedItem[] => [...feed, item].slice(-MAX_FEED);

const REPEAT_WINDOW_MS = 2500;
/** Minor moments (saves, power shots) happen every few seconds in big matches; show at most one per window. */
const MINOR_WINDOW_MS = 4000;
const MINOR_KINDS = new Set<GameEventKind>([GameEventKind.Save, GameEventKind.PowerBounce]);

/** Avoids spamming the feed with the same line or a stream of minor moments. */
export const isRepeat = (feed: FeedItem[], text: string, nowMs: number, kind?: GameEventKind): boolean =>
  feed.some(
    (item) =>
      nowMs - item.at < (kind && MINOR_KINDS.has(kind) && MINOR_KINDS.has(item.kind) ? MINOR_WINDOW_MS : REPEAT_WINDOW_MS) &&
      (item.text === text || (kind !== undefined && MINOR_KINDS.has(kind) && MINOR_KINDS.has(item.kind))),
  );
