import { describe, expect, it } from "vitest";
import { BotDifficulty, GameEventKind, GameMode, MatchPhase } from "@/types/game";
import { createMatch } from "@/game/match";
import {
  BALL_MAX_SPEED,
  COUNTDOWN_SECONDS,
  DASH_COOLDOWN,
  GOAL_CELEBRATION_SECONDS,
  PLAYER_MAX_SPEED,
  POWER_MIN_BOUNCE_SPEED,
  SIM_DT,
  SIM_HZ,
  TRAIL_MIN_BOUNCE_SPEED,
} from "@/game/constants";
import { stepSim } from "@/game/simulation";
import { lineTrail, makeMatch, makeRoster, parkPlayers, runCollect, runTicks, skipCountdown } from "@/game/test-helpers";

const ticksFor = (seconds: number): number => Math.ceil(seconds * SIM_HZ) + 2;

describe("countdown and kickoff", () => {
  it("freezes players during the countdown and then starts playing", () => {
    const state = makeMatch();
    const start = { x: state.players[0].x, y: state.players[0].y };
    runTicks(state, 30, { "p0-0": { mx: 1, my: 0, dash: 0 } });
    expect(state.players[0].x).toBe(start.x);
    expect(state.phase).toBe(MatchPhase.Countdown);
    runTicks(state, ticksFor(COUNTDOWN_SECONDS));
    expect(state.phase).toBe(MatchPhase.Playing);
  });

  it("does not fire a dash queued during the countdown", () => {
    const state = makeMatch();
    runTicks(state, 10, { "p0-0": { mx: 1, my: 0, dash: 3 } });
    skipCountdown(state);
    stepSim(state, { "p0-0": { mx: 1, my: 0, dash: 3 } }, SIM_DT);
    expect(state.players[0].dashTime).toBe(0);
  });
});

describe("movement and dash", () => {
  it("caps diagonal speed at the same max speed as straight movement", () => {
    const state = makeMatch();
    skipCountdown(state);
    runTicks(state, 60, { "p0-0": { mx: 1, my: 1, dash: 0 } });
    const speed = Math.hypot(state.players[0].vx, state.players[0].vy);
    expect(speed).toBeLessThanOrEqual(PLAYER_MAX_SPEED + 0.01);
    expect(speed).toBeGreaterThan(PLAYER_MAX_SPEED * 0.95);
  });

  it("ignores NaN and out of range input", () => {
    const state = makeMatch();
    skipCountdown(state);
    runTicks(state, 30, { "p0-0": { mx: Number.NaN, my: 99, dash: Number.NaN } });
    const p = state.players[0];
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(PLAYER_MAX_SPEED + 0.01);
  });

  it("dashes once per press and respects the cooldown", () => {
    const state = makeMatch();
    skipCountdown(state);
    const dashes = () => events.filter((e) => e.kind === GameEventKind.Dash).length;
    const events = runCollect(state, 1, { "p0-0": { mx: 0, my: -1, dash: 1 } });
    expect(state.players[0].dashTime).toBeGreaterThan(0);
    events.push(...runCollect(state, 20, { "p0-0": { mx: 0, my: -1, dash: 2 } }));
    expect(state.players[0].dashCooldown).toBeGreaterThan(0);
    expect(dashes()).toBe(1);
    events.push(...runCollect(state, ticksFor(DASH_COOLDOWN), { "p0-0": { mx: 0, my: 1, dash: 2 } }));
    events.push(...runCollect(state, 1, { "p0-0": { mx: 0, my: 1, dash: 3 } }));
    expect(dashes()).toBe(2);
  });

  it("keeps players inside the field and out of the nets", () => {
    const state = makeMatch();
    skipCountdown(state);
    runTicks(state, 400, { "p0-0": { mx: -1, my: 0.05, dash: 0 }, "p1-0": { mx: 1, my: -0.05, dash: 0 } });
    for (const p of state.players) {
      expect(p.x).toBeGreaterThanOrEqual(17.9);
      expect(p.x).toBeLessThanOrEqual(state.arena.width - 17.9);
    }
  });
});

describe("ball and trails", () => {
  it("bounces the ball off a trail and energises it", () => {
    const state = makeMatch();
    skipCountdown(state);
    parkPlayers(state);
    const owner = state.players[0];
    const cx = state.arena.width / 2;
    const cy = state.arena.height / 2;
    owner.trail = lineTrail(cx + 100, cy - 120, cx + 100, cy + 120, state.time);
    Object.assign(state.ball, { x: cx, y: cy, vx: 300, vy: 0 });
    runTicks(state, 30);
    expect(state.ball.vx).toBeLessThan(0);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeGreaterThan(TRAIL_MIN_BOUNCE_SPEED * 0.8);
    expect(state.ball.lastTouch?.playerId).toBe(owner.id);
    expect(owner.stats.bounces).toBe(1);
  });

  it("does not tunnel through a trail at max speed", () => {
    const state = makeMatch();
    skipCountdown(state);
    parkPlayers(state);
    const cx = state.arena.width / 2;
    const cy = state.arena.height / 2;
    state.players[1].trail = lineTrail(cx + 60, cy - 80, cx + 60, cy + 80, state.time, true);
    Object.assign(state.ball, { x: cx, y: cy, vx: BALL_MAX_SPEED, vy: 0 });
    runTicks(state, 6);
    expect(state.ball.x).toBeLessThan(cx + 60);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeGreaterThan(POWER_MIN_BOUNCE_SPEED * 0.9);
  });

  it("lets a running player push a resting ball", () => {
    const state = makeMatch();
    skipCountdown(state);
    const p = state.players[0];
    p.x = state.ball.x - 80;
    p.y = state.ball.y;
    runTicks(state, 40, { "p0-0": { mx: 1, my: 0, dash: 0 } });
    expect(state.ball.vx).toBeGreaterThan(50);
    expect(state.ball.lastTouch?.playerId).toBe(p.id);
  });

  it("slows an enemy that runs through a trail", () => {
    const state = makeMatch();
    skipCountdown(state);
    parkPlayers(state);
    const [owner, victim] = state.players;
    owner.trail = lineTrail(600, 200, 600, 500, state.time);
    victim.x = 560;
    victim.y = 350;
    const events = runCollect(state, 20, { [victim.id]: { mx: 1, my: 0, dash: 0 } });
    expect(events.some((e) => e.kind === GameEventKind.Slowed && e.playerId === victim.id)).toBe(true);
    expect(victim.slowTime).toBeGreaterThan(0);
  });
});

describe("scoring", () => {
  const shootInto = (team: number, scorerIndex: number | null, shooterIndex: number | null = null, shotAgo = 1) => {
    const state = makeMatch();
    skipCountdown(state);
    parkPlayers(state);
    const goal = state.arena.goals.find((g) => g.team === team);
    if (!goal) throw new Error("goal missing");
    if (shooterIndex !== null) {
      const shooter = state.players[shooterIndex];
      state.ball.prevTouch = { playerId: shooter.id, team: shooter.team, time: state.time - shotAgo };
    }
    if (scorerIndex !== null) {
      const scorer = state.players[scorerIndex];
      state.ball.lastTouch = { playerId: scorer.id, team: scorer.team, time: state.time };
    }
    Object.assign(state.ball, {
      x: goal.centerX + goal.inwardX * 60,
      y: goal.centerY,
      vx: -goal.inwardX * 600,
      vy: 0,
    });
    runTicks(state, 30);
    return state;
  };

  it("credits a goal to the attacking team and scorer", () => {
    const state = shootInto(1, 0);
    expect(state.scores).toEqual([1, 0]);
    expect(state.players[0].stats.goals).toBe(1);
    expect(state.phase).toBe(MatchPhase.GoalScored);
  });

  it("counts own goals for the other team", () => {
    const state = shootInto(0, 0);
    expect(state.scores).toEqual([0, 1]);
    expect(state.players[0].stats.ownGoals).toBe(1);
  });

  it("gives the shooter the goal when a defender deflects a recent shot in", () => {
    const shooter = makeMatch().players.findIndex((p) => p.team === 0);
    const defender = makeMatch().players.findIndex((p) => p.team === 1);
    const deflected = shootInto(1, defender, shooter, 1);
    expect(deflected.scores).toEqual([1, 0]);
    expect(deflected.players[shooter].stats.goals).toBe(1);
    expect(deflected.players[defender].stats.ownGoals).toBe(0);
    const stale = shootInto(1, defender, shooter, 10);
    expect(stale.players[defender].stats.ownGoals).toBe(1);
    expect(stale.players[shooter].stats.goals).toBe(0);
  });

  it("only scores once and restarts with a fresh kickoff", () => {
    const state = shootInto(1, 0);
    runTicks(state, ticksFor(GOAL_CELEBRATION_SECONDS));
    expect(state.scores).toEqual([1, 0]);
    expect(state.phase).toBe(MatchPhase.Countdown);
    expect(state.ball.x).toBe(state.arena.width / 2);
    expect(state.players.every((p) => p.trail.length === 0)).toBe(true);
  });

  it("goes to golden goal overtime on a draw and ends on the next goal", () => {
    const state = makeMatch(GameMode.Solo, false, undefined, 1);
    skipCountdown(state);
    runTicks(state, ticksFor(1));
    expect(state.overtime).toBe(true);
    expect(state.phase).toBe(MatchPhase.Playing);
    parkPlayers(state);
    state.ball.lastTouch = { playerId: "p1-0", team: 1, time: state.time };
    Object.assign(state.ball, { x: 60, y: state.arena.height / 2, vx: -600, vy: 0 });
    runTicks(state, 30 + ticksFor(GOAL_CELEBRATION_SECONDS));
    expect(state.phase).toBe(MatchPhase.Ended);
    expect(state.winner).toBe(1);
  });

  it("ends with a winner when time runs out with a lead", () => {
    const state = makeMatch(GameMode.Solo, false, undefined, 1);
    skipCountdown(state);
    state.scores[0] = 2;
    runTicks(state, ticksFor(1));
    expect(state.phase).toBe(MatchPhase.Ended);
    expect(state.winner).toBe(0);
  });
});

describe("chaar kone (free for all)", () => {
  it("removes a life per goal, eliminates and closes the goal", () => {
    const state = makeMatch(GameMode.FreeForAll);
    for (let goal = 0; goal < 5; goal += 1) {
      skipCountdown(state);
      parkPlayers(state);
      state.ball.lastTouch = { playerId: "p1-0", team: 1, time: state.time };
      Object.assign(state.ball, { x: 60, y: state.arena.height / 2, vx: -700, vy: 0 });
      runTicks(state, 30 + ticksFor(GOAL_CELEBRATION_SECONDS));
    }
    expect(state.lives[0]).toBe(0);
    expect(state.closedGoals).toContain(0);
    expect(state.players.find((p) => p.team === 0)?.eliminated).toBe(true);
    expect(state.players.find((p) => p.team === 1)?.stats.goals).toBe(5);
  });

  it("closes goals of empty slots from the start", () => {
    const roster = makeRoster(GameMode.FreeForAll, false).filter((entry) => entry.team !== 3);
    const state = createMatch({ mode: GameMode.FreeForAll, durationSec: 60, botDifficulty: BotDifficulty.Normal }, roster, 1);
    expect(state.closedGoals).toEqual([3]);
    expect(state.lives[3]).toBe(0);
  });
});
