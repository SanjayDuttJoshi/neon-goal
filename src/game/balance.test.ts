import { describe, expect, it } from "vitest";
import { BotDifficulty, GameEventKind, GameMode, MatchPhase } from "@/types/game";
import { SIM_DT } from "@/game/constants";
import { stepSim } from "@/game/simulation";
import { makeMatch } from "@/game/test-helpers";

const SEEDS = [3, 7, 11, 19];
const MATCH_SEC = 120;

/** Average goals in a 2-minute bot-only match (FFA counts every goal against a life). */
const averageGoals = (mode: GameMode, difficulty: BotDifficulty): number => {
  let total = 0;
  for (const seed of SEEDS) {
    const state = makeMatch(mode, true, difficulty, MATCH_SEC, seed);
    const maxTicks = (MATCH_SEC + 200) * 60;
    for (let i = 0; i < maxTicks && state.phase !== MatchPhase.Ended && !state.overtime; i += 1) {
      stepSim(state, {}, SIM_DT);
      total += state.events.filter((e) => e.kind === GameEventKind.Goal).length;
      state.events = [];
    }
  }
  return total / SEEDS.length;
};

/** Matches only feel alive when goals keep coming, so guard the pace in every mode. */
describe("match pace", () => {
  const cases: Array<[GameMode, BotDifficulty, number]> = [
    [GameMode.Solo, BotDifficulty.Normal, 6],
    [GameMode.Duo, BotDifficulty.Normal, 2.5],
    [GameMode.Duo, BotDifficulty.Hard, 3.5],
    [GameMode.Squad, BotDifficulty.Normal, 3],
    [GameMode.FreeForAll, BotDifficulty.Normal, 6],
  ];
  for (const [mode, difficulty, minimum] of cases) {
    it(`${mode} / ${difficulty} averages at least ${minimum} goals in 2 minutes`, () => {
      const avg = averageGoals(mode, difficulty);
      expect(avg).toBeGreaterThanOrEqual(minimum);
    });
  }
});
