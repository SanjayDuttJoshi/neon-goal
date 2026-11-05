import { describe, expect, it } from "vitest";
import { BotDifficulty, GameEventKind, GameMode, RedBallMode, type MatchConfig, type SimState } from "@/types/game";
import { HEAT_TO_RED, OUT_SECONDS, RED_IGNITION_SECONDS, RED_MAX_SECONDS, RED_TOUCHES, SIM_DT } from "@/game/constants";
import { computeBotInput } from "@/game/bots";
import { burnsPlayer, isRed, onTrailBounce } from "@/game/red-ball";
import { makeMatch, parkPlayers, runCollect, runTicks, skipCountdown } from "@/game/test-helpers";

type Rules = Pick<MatchConfig, "redBall" | "arenaEvents">;
const RED_RULES: Rules = { redBall: RedBallMode.Long, arenaEvents: false };

const playing = (rules: Rules = RED_RULES, bots = false): SimState => {
  const state = makeMatch(GameMode.Solo, bots, BotDifficulty.Hard, 360, 7, rules);
  skipCountdown(state);
  parkPlayers(state);
  state.ball.coolTime = 0;
  return state;
};

const heatUp = (state: SimState): void => {
  for (let i = 0; i < HEAT_TO_RED[state.config.mode]; i += 1) onTrailBounce(state);
};

/** Red and already past the ignition grace, so it burns on contact. */
const ignite = (state: SimState): void => {
  heatUp(state);
  state.ball.redTime = RED_MAX_SECONDS - RED_IGNITION_SECONDS - 0.05;
};

const secondsToTicks = (seconds: number): number => Math.ceil(seconds / SIM_DT);

describe("red ball", () => {
  it("turns red after enough trail bounces, then cools after its red touches", () => {
    const state = playing();
    for (let i = 0; i < HEAT_TO_RED[GameMode.Solo] - 1; i += 1) onTrailBounce(state);
    expect(isRed(state.ball)).toBe(false);
    onTrailBounce(state);
    expect(state.ball.redLeft).toBe(RED_TOUCHES);
    expect(state.events.some((e) => e.kind === GameEventKind.BallRed)).toBe(true);
    for (let i = 0; i < RED_TOUCHES; i += 1) onTrailBounce(state);
    expect(isRed(state.ball)).toBe(false);
    expect(state.ball.coolTime).toBeGreaterThan(0);
    onTrailBounce(state);
    expect(state.ball.heat).toBe(0);
  });

  it("stays normal for the first seconds after a kickoff", () => {
    const state = makeMatch(GameMode.Solo, false, BotDifficulty.Hard, 360, 7, RED_RULES);
    skipCountdown(state);
    heatUp(state);
    expect(isRed(state.ball)).toBe(false);
  });

  it("cools down by itself when nobody plays it", () => {
    const state = playing();
    heatUp(state);
    runTicks(state, secondsToTicks(RED_MAX_SECONDS + 0.5));
    expect(isRed(state.ball)).toBe(false);
  });

  it("never heats up when the red ball is switched off", () => {
    const state = playing({ redBall: RedBallMode.Off, arenaEvents: false });
    heatUp(state);
    heatUp(state);
    expect(isRed(state.ball)).toBe(false);
  });

  it("gives players a moment to back off right after the ball turns red", () => {
    const state = playing();
    heatUp(state);
    const victim = state.players[1];
    Object.assign(victim, { x: 500, y: 300, vx: 0, vy: 0 });
    Object.assign(state.ball, { x: 470, y: 300, vx: 200, vy: 0 });
    runTicks(state, 10);
    expect(victim.outTime).toBe(0);
  });

  it("knocks out a player it touches, passes through, and brings them back shielded", () => {
    const state = playing();
    ignite(state);
    const victim = state.players[1];
    Object.assign(victim, { x: 500, y: 300, vx: 0, vy: 0 });
    Object.assign(state.ball, { x: 440, y: 300, vx: 400, vy: 0 });
    const events = runCollect(state, 20);
    expect(events.some((e) => e.kind === GameEventKind.KnockOut && e.playerId === victim.id)).toBe(true);
    expect(victim.outTime).toBeGreaterThan(OUT_SECONDS[RedBallMode.Long] - 1);
    expect(state.ball.vx).toBeGreaterThan(0);
    Object.assign(state.ball, { vx: 0, vy: 0 });
    runTicks(state, secondsToTicks(OUT_SECONDS[RedBallMode.Long]));
    expect(victim.outTime).toBe(0);
    expect(victim.shieldTime).toBeGreaterThan(0);
    expect(burnsPlayer(state, victim)).toBe(false);
  });

  it("uses the shorter knock-out when the host picks 6 seconds", () => {
    const state = playing({ redBall: RedBallMode.Short, arenaEvents: false });
    ignite(state);
    const victim = state.players[1];
    Object.assign(victim, { x: 500, y: 300 });
    Object.assign(state.ball, { x: 470, y: 300, vx: 200, vy: 0 });
    runTicks(state, 10);
    expect(victim.outTime).toBeLessThanOrEqual(OUT_SECONDS[RedBallMode.Short]);
    expect(victim.outTime).toBeGreaterThan(OUT_SECONDS[RedBallMode.Short] - 1);
  });

  it("scores a red-ball goal double", () => {
    const state = playing();
    heatUp(state);
    const goal = state.arena.goals.find((g) => g.team === 1);
    if (!goal) throw new Error("goal missing");
    state.ball.lastTouch = { playerId: state.players[0].id, team: 0, time: state.time };
    Object.assign(state.ball, { x: goal.centerX + goal.inwardX * 60, y: goal.centerY, vx: -goal.inwardX * 600, vy: 0 });
    const events = runCollect(state, 30);
    expect(state.scores).toEqual([2, 0]);
    expect(events.find((e) => e.kind === GameEventKind.GoalBonus)?.value).toBe(2);
  });

  it("makes a bot sidestep a red ball coming straight at it", () => {
    const state = playing(RED_RULES, true);
    heatUp(state);
    const bot = state.players[1];
    Object.assign(bot, { x: 640, y: 300, vx: 0, vy: 0 });
    bot.brain.thinkTimer = 0;
    Object.assign(state.ball, { x: 420, y: 300, vx: 600, vy: 0 });
    const input = computeBotInput(state, bot, SIM_DT);
    expect(Math.abs(input.my)).toBeGreaterThan(Math.abs(input.mx));
  });
});
