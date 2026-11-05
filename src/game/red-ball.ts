import { GameEventKind, MatchPhase, RedBallMode, type BallState, type PlayerState, type SimState } from "@/types/game";
import {
  HEAT_TO_RED,
  OUT_SECONDS,
  RED_COOLDOWN_SECONDS,
  RED_IGNITION_SECONDS,
  RED_MAX_SECONDS,
  RED_TOUCHES,
  RESPAWN_SHIELD_SECONDS,
} from "@/game/constants";
import { pushEvent } from "@/game/events";

/**
 * Red ball: after enough trail bounces the ball turns red. While red it may only
 * touch neon trails; any player it touches is out for a while, then comes back
 * with a short shield. A few red bounces (or a timeout) cool it down again.
 */

export const isRed = (ball: BallState): boolean => ball.redLeft > 0;

export const resetBallHeat = (ball: BallState): void => {
  ball.heat = 0;
  ball.redLeft = 0;
  ball.redTime = 0;
  ball.coolTime = 0;
};

const redBallOn = (state: SimState): boolean => state.config.redBall !== RedBallMode.Off;

const coolDown = (state: SimState): void => {
  resetBallHeat(state.ball);
  state.ball.coolTime = RED_COOLDOWN_SECONDS;
  pushEvent(state, { kind: GameEventKind.BallCooled, x: state.ball.x, y: state.ball.y });
};

/** Counts a trail bounce: heats a normal ball, or uses up one of the red touches. */
export const onTrailBounce = (state: SimState): void => {
  const { ball } = state;
  if (!redBallOn(state) || state.phase !== MatchPhase.Playing) return;
  if (isRed(ball)) {
    ball.redLeft -= 1;
    if (ball.redLeft <= 0) coolDown(state);
    return;
  }
  if (ball.coolTime > 0) return;
  ball.heat += 1;
  if (ball.heat < HEAT_TO_RED[state.config.mode]) return;
  ball.heat = 0;
  ball.redLeft = RED_TOUCHES;
  ball.redTime = RED_MAX_SECONDS;
  pushEvent(state, { kind: GameEventKind.BallRed, x: ball.x, y: ball.y });
};

export const tickBallHeat = (state: SimState, dt: number): void => {
  const { ball } = state;
  if (!isRed(ball)) {
    ball.coolTime = Math.max(0, ball.coolTime - dt);
    return;
  }
  ball.redTime -= dt;
  if (ball.redTime <= 0) coolDown(state);
};

/** Red and past its first second (the ignition grace). */
export const isBurning = (ball: BallState): boolean => isRed(ball) && ball.redTime <= RED_MAX_SECONDS - RED_IGNITION_SECONDS;

/** True when touching the ball right now would knock this player out. */
export const burnsPlayer = (state: SimState, player: PlayerState): boolean =>
  isBurning(state.ball) && state.phase === MatchPhase.Playing && player.shieldTime <= 0 && player.outTime <= 0;

export const knockOut = (state: SimState, player: PlayerState): void => {
  const seconds = OUT_SECONDS[state.config.redBall];
  player.outTime = seconds;
  player.trail = [];
  player.vx = 0;
  player.vy = 0;
  player.dashTime = 0;
  const touch = state.ball.lastTouch;
  const attacker = touch && touch.playerId !== player.id ? state.players.find((p) => p.id === touch.playerId) : undefined;
  if (attacker && attacker.team !== player.team) attacker.stats.knockouts += 1;
  pushEvent(state, { kind: GameEventKind.KnockOut, x: player.x, y: player.y, team: player.team, playerId: player.id, value: seconds });
};

/** Counts down knock-outs and shields; players come back at their spawn point. */
export const tickOutPlayers = (state: SimState, dt: number, spawnOf: (player: PlayerState) => { x: number; y: number }): void => {
  for (const player of state.players) {
    player.shieldTime = Math.max(0, player.shieldTime - dt);
    if (player.outTime <= 0) continue;
    player.outTime -= dt;
    if (player.outTime > 0) continue;
    const spawn = spawnOf(player);
    player.outTime = 0;
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.shieldTime = RESPAWN_SHIELD_SECONDS;
    pushEvent(state, { kind: GameEventKind.Respawn, x: player.x, y: player.y, team: player.team, playerId: player.id });
  }
};
