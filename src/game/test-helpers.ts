import { BotDifficulty, GameMode, MatchPhase, type GameEvent, type RosterEntry, type SimState, type TrailPoint } from "@/types/game";
import { MODE_INFO, SIM_DT } from "@/game/constants";
import { createMatch } from "@/game/match";
import { stepSim, type InputMap } from "@/game/simulation";

export const makeRoster = (mode: GameMode, bots: boolean): RosterEntry[] => {
  const info = MODE_INFO[mode];
  const roster: RosterEntry[] = [];
  for (let team = 0; team < info.teamCount; team += 1) {
    for (let slot = 0; slot < info.teamSize; slot += 1) {
      roster.push({ id: `p${team}-${slot}`, name: `P${team}${slot}`, team, isBot: bots });
    }
  }
  return roster;
};

export const makeMatch = (
  mode = GameMode.Solo,
  bots = false,
  difficulty = BotDifficulty.Normal,
  durationSec = 180,
  seed = 7,
): SimState => createMatch({ mode, durationSec, botDifficulty: difficulty }, makeRoster(mode, bots), seed);

/** Runs the countdown so the match is in the playing phase. */
export const skipCountdown = (state: SimState): void => {
  while (state.phase === MatchPhase.Countdown) stepSim(state, {}, SIM_DT);
};

export const runTicks = (state: SimState, ticks: number, inputs: InputMap = {}): void => {
  for (let i = 0; i < ticks; i += 1) stepSim(state, inputs, SIM_DT);
};

/** Moves every player far away from the action so they don't interfere. */
export const parkPlayers = (state: SimState): void => {
  state.players.forEach((player, index) => {
    player.x = 60 + index * 45;
    player.y = state.arena.height - 60;
    player.vx = 0;
    player.vy = 0;
    player.trail = [];
  });
};

/** Builds a trail along a straight line with points as dense as real emission. */
export const lineTrail = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  time: number,
  power = false,
): TrailPoint[] => {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 7));
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: x1 + ((x2 - x1) * i) / steps,
    y: y1 + ((y2 - y1) * i) / steps,
    t: time - 0.5 + (0.3 * i) / steps,
    power,
  }));
};

/** Steps the sim and collects every event emitted, like the host does. */
export const runCollect = (state: SimState, ticks: number, inputs: InputMap = {}): GameEvent[] => {
  const collected: GameEvent[] = [];
  for (let i = 0; i < ticks; i += 1) {
    stepSim(state, inputs, SIM_DT);
    collected.push(...state.events);
    state.events = [];
  }
  return collected;
};
