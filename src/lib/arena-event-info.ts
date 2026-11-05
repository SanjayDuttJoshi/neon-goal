import { ArenaEventKind } from "@/types/game";
import { ARENA_EVENT_ORDER } from "@/game/constants";

export interface ArenaEventInfo {
  icon: string;
  title: string;
  /** Short line shown with the warning. */
  hint: string;
  color: string;
}

export const ARENA_EVENT_INFO: Record<ArenaEventKind, ArenaEventInfo> = {
  [ArenaEventKind.Blackout]: { icon: "🌑", title: "Blackout", hint: "Lights jaane wali hain", color: "#a78bfa" },
  [ArenaEventKind.MovingWalls]: { icon: "🧱", title: "Moving walls", hint: "Beech mein deewaarein aa rahi hain", color: "#e879f9" },
  [ArenaEventKind.Ice]: { icon: "🧊", title: "Ice floor", hint: "Zameen phisalne wali hai", color: "#7dd3fc" },
  [ArenaEventKind.GoldenTime]: { icon: "⭐", title: "Golden time", hint: "Har goal DOUBLE", color: "#facc15" },
};

/** Event kinds travel as their index in ARENA_EVENT_ORDER. */
export const arenaEventInfoAt = (index: number): ArenaEventInfo | null => {
  const kind = ARENA_EVENT_ORDER[index];
  return kind ? ARENA_EVENT_INFO[kind] : null;
};
