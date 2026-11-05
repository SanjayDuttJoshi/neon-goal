import { describe, expect, it } from "vitest";
import { BotDifficulty, GameEventKind, GameMode, MatchPhase, RedBallMode } from "@/types/game";
import { SIM_DT } from "@/game/constants";
import { stepSim } from "@/game/simulation";
import { makeMatch } from "@/game/test-helpers";

const SEEDS = [3, 7, 11];
const MATCH_SEC = 360;
const V2_RULES = { redBall: RedBallMode.Long, arenaEvents: true };

interface Pace {
  goals: number;
  points: number;
  reds: number;
  knockouts: number;
  events: number;
}

/** Per-match averages for a 6-minute bot-only V2 match. */
const measure = (mode: GameMode, difficulty: BotDifficulty): Pace => {
  const sum: Pace = { goals: 0, points: 0, reds: 0, knockouts: 0, events: 0 };
  for (const seed of SEEDS) {
    const state = makeMatch(mode, true, difficulty, MATCH_SEC, seed, V2_RULES);
    const maxTicks = (MATCH_SEC + 200) * 60;
    for (let i = 0; i < maxTicks && state.phase !== MatchPhase.Ended && !state.overtime; i += 1) {
      stepSim(state, {}, SIM_DT);
      for (const e of state.events) {
        if (e.kind === GameEventKind.Goal) sum.goals += 1;
        if (e.kind === GameEventKind.BallRed) sum.reds += 1;
        if (e.kind === GameEventKind.KnockOut) sum.knockouts += 1;
        if (e.kind === GameEventKind.ArenaStart) sum.events += 1;
      }
      state.events = [];
    }
    sum.points += state.scores.reduce((a, b) => a + b, 0);
  }
  const n = SEEDS.length;
  return { goals: sum.goals / n, points: sum.points / n, reds: sum.reds / n, knockouts: sum.knockouts / n, events: sum.events / n };
};

/**
 * V2 twists must add danger without killing the game: the ball still goes red
 * regularly, events keep coming, goals keep flowing, and bots don't spend the
 * whole match knocked out.
 */
describe("V2 match pace (red ball + arena events, 6 minutes)", () => {
  const cases: Array<[GameMode, BotDifficulty, number]> = [
    [GameMode.Solo, BotDifficulty.Normal, 12],
    [GameMode.Duo, BotDifficulty.Hard, 9],
    [GameMode.Squad, BotDifficulty.Normal, 6],
  ];
  for (const [mode, difficulty, minGoals] of cases) {
    it(`${mode} / ${difficulty} stays lively`, () => {
      const pace = measure(mode, difficulty);
      console.info(`${mode}/${difficulty}`, JSON.stringify(pace));
      expect(pace.reds).toBeGreaterThanOrEqual(6);
      expect(pace.events).toBeGreaterThanOrEqual(6);
      expect(pace.goals).toBeGreaterThanOrEqual(minGoals);
      expect(pace.knockouts).toBeLessThanOrEqual(pace.reds);
    });
  }
});
