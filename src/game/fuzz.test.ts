import { describe, expect, it } from "vitest";
import { BotDifficulty, GameEventKind, GameMode, MatchPhase, type SimState } from "@/types/game";
import { BALL_RADIUS, PLAYER_RADIUS, SIM_DT } from "@/game/constants";
import { stepSim } from "@/game/simulation";
import { makeMatch } from "@/game/test-helpers";

const NET_SLACK = 90;

const assertSane = (state: SimState): void => {
  const { ball, arena } = state;
  const values = [ball.x, ball.y, ball.vx, ball.vy, ...state.players.flatMap((p) => [p.x, p.y, p.vx, p.vy])];
  if (!values.every(Number.isFinite)) throw new Error(`non finite value at tick ${state.tick}`);
  if (ball.x < -NET_SLACK || ball.x > arena.width + NET_SLACK || ball.y < -NET_SLACK || ball.y > arena.height + NET_SLACK) {
    throw new Error(`ball escaped at tick ${state.tick}: ${ball.x},${ball.y}`);
  }
  for (const p of state.players) {
    if (p.x < PLAYER_RADIUS - 0.5 || p.x > arena.width - PLAYER_RADIUS + 0.5) throw new Error(`player escaped x ${p.x}`);
    if (p.y < PLAYER_RADIUS - 0.5 || p.y > arena.height - PLAYER_RADIUS + 0.5) throw new Error(`player escaped y ${p.y}`);
  }
  const insideField = ball.x >= BALL_RADIUS - 0.5 && ball.x <= arena.width - BALL_RADIUS + 0.5;
  if (!insideField && state.phase === MatchPhase.Playing && state.config.mode !== GameMode.FreeForAll) {
    const inMouth = arena.goals.some(
      (g) => ball.y >= Math.min(g.mouth.ay, g.mouth.by) - BALL_RADIUS && ball.y <= Math.max(g.mouth.ay, g.mouth.by) + BALL_RADIUS,
    );
    if (!inMouth) throw new Error(`ball outside field away from goal ${ball.x},${ball.y}`);
  }
};

const playFullMatch = (mode: GameMode, difficulty: BotDifficulty, seed: number, durationSec: number) => {
  const state = makeMatch(mode, true, difficulty, durationSec, seed);
  let goals = 0;
  const maxTicks = (durationSec + 200) * 60 * 2;
  for (let i = 0; i < maxTicks && state.phase !== MatchPhase.Ended; i += 1) {
    stepSim(state, {}, SIM_DT);
    goals += state.events.filter((e) => e.kind === GameEventKind.Goal).length;
    state.events = [];
    assertSane(state);
  }
  return { state, goals };
};

describe("bot vs bot full matches stay sane", () => {
  const cases: Array<[GameMode, BotDifficulty]> = [
    [GameMode.Solo, BotDifficulty.Hard],
    [GameMode.Duo, BotDifficulty.Normal],
    [GameMode.Squad, BotDifficulty.Hard],
    [GameMode.Squad, BotDifficulty.Easy],
    [GameMode.FreeForAll, BotDifficulty.Normal],
  ];
  for (const [mode, difficulty] of cases) {
    it(`${mode} / ${difficulty}`, () => {
      let totalGoals = 0;
      for (const seed of [1, 2, 42]) {
        const { state, goals } = playFullMatch(mode, difficulty, seed, 120);
        expect(state.phase).toBe(MatchPhase.Ended);
        expect(state.winner).not.toBeNull();
        const statGoals = state.players.reduce((sum, p) => sum + p.stats.goals + p.stats.ownGoals, 0);
        expect(statGoals).toBeLessThanOrEqual(goals);
        totalGoals += goals;
      }
      expect(totalGoals).toBeGreaterThan(0);
    });
  }
});
