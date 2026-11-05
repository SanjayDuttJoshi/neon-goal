import { describe, expect, it } from "vitest";
import { ArenaEventKind, ArenaEventStage, BotDifficulty, GameEventKind, GameMode, RedBallMode, type SimState } from "@/types/game";
import { ARENA_EVENT_ORDER, ARENA_EVENT_SECONDS, SIM_DT } from "@/game/constants";
import { movingBars } from "@/game/moving-walls";
import { makeMatch, parkPlayers, runCollect, runTicks, skipCountdown } from "@/game/test-helpers";

const EVENT_RULES = { redBall: RedBallMode.Off, arenaEvents: true };

const playing = (rules = EVENT_RULES): SimState => {
  const state = makeMatch(GameMode.Solo, false, BotDifficulty.Normal, 360, 11, rules);
  skipCountdown(state);
  parkPlayers(state);
  return state;
};

const activate = (state: SimState, kind: ArenaEventKind): void => {
  state.arenaEvent = { kind, stage: ArenaEventStage.Active, timer: ARENA_EVENT_SECONDS[kind], nextIn: 0, lastKind: null };
};

describe("arena events", () => {
  it("warns, runs and ends events one at a time, never the same twice in a row", () => {
    const state = playing();
    const events = runCollect(state, Math.ceil(200 / SIM_DT)).filter((e) =>
      [GameEventKind.ArenaWarn, GameEventKind.ArenaStart, GameEventKind.ArenaEnd].includes(e.kind),
    );
    expect(events.length).toBeGreaterThanOrEqual(9);
    const order = [GameEventKind.ArenaWarn, GameEventKind.ArenaStart, GameEventKind.ArenaEnd];
    events.forEach((e, i) => expect(e.kind).toBe(order[i % 3]));
    const kinds = events.filter((e) => e.kind === GameEventKind.ArenaStart).map((e) => e.value);
    kinds.slice(1).forEach((kind, i) => expect(kind).not.toBe(kinds[i]));
  });

  it("stays quiet when events are switched off", () => {
    const state = playing({ redBall: RedBallMode.Off, arenaEvents: false });
    const events = runCollect(state, Math.ceil(120 / SIM_DT));
    expect(events.some((e) => e.kind === GameEventKind.ArenaWarn)).toBe(false);
  });

  it("doubles goals during golden time", () => {
    const state = playing();
    activate(state, ArenaEventKind.GoldenTime);
    const goal = state.arena.goals.find((g) => g.team === 1);
    if (!goal) throw new Error("goal missing");
    state.ball.lastTouch = { playerId: state.players[0].id, team: 0, time: state.time };
    Object.assign(state.ball, { x: goal.centerX + goal.inwardX * 60, y: goal.centerY, vx: -goal.inwardX * 600, vy: 0 });
    runTicks(state, 30);
    expect(state.scores).toEqual([2, 0]);
  });

  it("makes players slide on ice", () => {
    const run = (ice: boolean): number => {
      const state = playing();
      if (ice) activate(state, ArenaEventKind.Ice);
      const id = state.players[0].id;
      runTicks(state, 30, { [id]: { mx: 1, my: 0, dash: 0 } });
      runTicks(state, 12, { [id]: { mx: 0, my: 0, dash: 0 } });
      return Math.abs(state.players[0].vx);
    };
    expect(run(true)).toBeGreaterThan(run(false) + 50);
  });

  it("bounces the ball off the moving walls", () => {
    const state = playing();
    activate(state, ArenaEventKind.MovingWalls);
    const [bar] = movingBars(state.arena, state.arenaEvent);
    Object.assign(state.ball, { x: bar.ax - 50, y: (bar.ay + bar.by) / 2, vx: 700, vy: 0 });
    runTicks(state, 12);
    expect(state.ball.vx).toBeLessThan(0);
  });

  it("cycles through every kind of event", () => {
    const state = playing();
    const starts = runCollect(state, Math.ceil(600 / SIM_DT)).filter((e) => e.kind === GameEventKind.ArenaStart);
    const seen = new Set(starts.map((e) => ARENA_EVENT_ORDER[e.value]));
    expect(seen.size).toBe(ARENA_EVENT_ORDER.length);
  });
});
