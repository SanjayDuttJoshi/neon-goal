import { GameEventKind, type GoalDef, type PlayerState, type SimState, type WallDef } from "@/types/game";
import {
  BALL_BODY_RESTITUTION,
  BALL_MAX_SPEED,
  BALL_RADIUS,
  BALL_WALL_RESTITUTION,
  PLAYER_RADIUS,
  POWER_MIN_BOUNCE_SPEED,
  SAVE_LOOKAHEAD,
  SAVE_MIN_SPEED,
  TRAIL_BOUNCE_GAIN,
  TRAIL_HALF_WIDTH,
  TRAIL_MIN_BOUNCE_SPEED,
} from "@/game/constants";
import { pushEvent } from "@/game/events";
import { collideBallWithBars } from "@/game/moving-walls";
import { bounceVelocity, circleSegmentHit, wallContact, type SegmentHit } from "@/game/physics";
import { isOnField } from "@/game/players";
import { burnsPlayer, knockOut, onTrailBounce } from "@/game/red-ball";
import { forEachActiveSegment } from "@/game/trails";
import { raySegmentDistance } from "@/game/vector";

const WALL_EVENT_MIN_SPEED = 260;
const BODY_EVENT_MIN_SPEED = 140;

export const ballWallSegments = (state: SimState): WallDef[] => {
  const segments: WallDef[] = [...state.arena.walls];
  for (const goal of state.arena.goals) {
    segments.push(...goal.netWalls);
    if (state.closedGoals.includes(goal.team)) segments.push(goal.mouth);
  }
  return segments;
};

const goalOf = (state: SimState, team: number): GoalDef | undefined =>
  state.arena.goals.find((goal) => goal.team === team);

/** True when the ball is travelling fast towards the open goal of a team. */
export const isShotOnGoal = (state: SimState, team: number): boolean => {
  const goal = goalOf(state, team);
  if (!goal || state.closedGoals.includes(team)) return false;
  const { ball } = state;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < SAVE_MIN_SPEED) return false;
  const dist = raySegmentDistance(ball.x, ball.y, ball.vx / speed, ball.vy / speed, goal.mouth);
  return dist !== null && dist < SAVE_LOOKAHEAD;
};

const registerTouch = (state: SimState, player: PlayerState): void => {
  const { ball } = state;
  if (ball.lastTouch && ball.lastTouch.team !== player.team) ball.prevTouch = ball.lastTouch;
  ball.lastTouch = { playerId: player.id, team: player.team, time: state.time };
};

const registerSave = (state: SimState, player: PlayerState, wasOnTarget: boolean): void => {
  if (!wasOnTarget || isShotOnGoal(state, player.team)) return;
  player.stats.saves += 1;
  pushEvent(state, { kind: GameEventKind.Save, x: state.ball.x, y: state.ball.y, team: player.team, playerId: player.id });
};

const clampBallSpeed = (state: SimState): void => {
  const { ball } = state;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > BALL_MAX_SPEED) {
    ball.vx = (ball.vx / speed) * BALL_MAX_SPEED;
    ball.vy = (ball.vy / speed) * BALL_MAX_SPEED;
  }
};

const handleTrailHit = (state: SimState, owner: PlayerState, hit: SegmentHit, power: boolean): void => {
  const { ball } = state;
  ball.x = hit.qx + hit.nx * (BALL_RADIUS + TRAIL_HALF_WIDTH + 0.01);
  ball.y = hit.qy + hit.ny * (BALL_RADIUS + TRAIL_HALF_WIDTH + 0.01);
  const vn = ball.vx * hit.nx + ball.vy * hit.ny;
  if (vn >= 0) return;
  const wasOnTarget = isShotOnGoal(state, owner.team);
  const rx = ball.vx - 2 * vn * hit.nx;
  const ry = ball.vy - 2 * vn * hit.ny;
  const speed = Math.hypot(rx, ry) || 1;
  const minSpeed = power ? POWER_MIN_BOUNCE_SPEED : TRAIL_MIN_BOUNCE_SPEED;
  const newSpeed = Math.min(BALL_MAX_SPEED, Math.max(speed * TRAIL_BOUNCE_GAIN, minSpeed));
  ball.vx = (rx / speed) * newSpeed;
  ball.vy = (ry / speed) * newSpeed;
  registerTouch(state, owner);
  onTrailBounce(state);
  owner.stats.bounces += 1;
  if (power) owner.stats.powerShots += 1;
  pushEvent(state, {
    kind: power ? GameEventKind.PowerBounce : GameEventKind.TrailBounce,
    x: ball.x,
    y: ball.y,
    team: owner.team,
    playerId: owner.id,
    value: newSpeed,
  });
  registerSave(state, owner, wasOnTarget);
};

const collideBallWithWalls = (state: SimState, walls: WallDef[]): void => {
  const { ball } = state;
  for (const wall of walls) {
    const hit = wallContact(ball.x, ball.y, BALL_RADIUS, wall);
    if (!hit) continue;
    ball.x += hit.nx * hit.depth;
    ball.y += hit.ny * hit.depth;
    const impact = -(ball.vx * hit.nx + ball.vy * hit.ny);
    const bounced = bounceVelocity(ball.vx, ball.vy, hit.nx, hit.ny, BALL_WALL_RESTITUTION);
    if (!bounced) continue;
    ball.vx = bounced.vx;
    ball.vy = bounced.vy;
    if (impact > WALL_EVENT_MIN_SPEED) {
      pushEvent(state, { kind: GameEventKind.WallHit, x: ball.x, y: ball.y, value: impact });
    }
  }
};

const collideBallWithTrails = (state: SimState): void => {
  const { ball } = state;
  for (const owner of state.players) {
    if (!isOnField(owner)) continue;
    forEachActiveSegment(owner, state.time, ({ seg, power }) => {
      const hit = circleSegmentHit(ball.x, ball.y, BALL_RADIUS, seg, TRAIL_HALF_WIDTH, ball.vx, ball.vy);
      if (!hit) return false;
      handleTrailHit(state, owner, hit, power);
      return true;
    });
  }
};

const collideBallWithBodies = (state: SimState): void => {
  const { ball } = state;
  const minDist = BALL_RADIUS + PLAYER_RADIUS;
  for (const player of state.players) {
    if (!isOnField(player)) continue;
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= minDist) continue;
    if (burnsPlayer(state, player)) {
      knockOut(state, player);
      continue;
    }
    let nx = dist > 1e-6 ? dx / dist : -player.faceX;
    let ny = dist > 1e-6 ? dy / dist : -player.faceY;
    if (nx === 0 && ny === 0) {
      nx = 1;
      ny = 0;
    }
    ball.x = player.x + nx * minDist;
    ball.y = player.y + ny * minDist;
    const rel = (ball.vx - player.vx) * nx + (ball.vy - player.vy) * ny;
    if (rel >= 0) continue;
    const wasOnTarget = isShotOnGoal(state, player.team);
    ball.vx -= (1 + BALL_BODY_RESTITUTION) * rel * nx;
    ball.vy -= (1 + BALL_BODY_RESTITUTION) * rel * ny;
    registerTouch(state, player);
    if (-rel > BODY_EVENT_MIN_SPEED) {
      pushEvent(state, { kind: GameEventKind.BodyHit, x: ball.x, y: ball.y, team: player.team, playerId: player.id, value: -rel });
    }
    registerSave(state, player, wasOnTarget);
  }
};

/** A ball pinned against a wall is solid: players overlapping it get pushed back. */
const unpinPlayers = (state: SimState): void => {
  const { ball } = state;
  const minDist = BALL_RADIUS + PLAYER_RADIUS;
  for (const player of state.players) {
    if (!isOnField(player)) continue;
    const dx = player.x - ball.x;
    const dy = player.y - ball.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= minDist || dist < 1e-6) continue;
    const nx = dx / dist;
    const ny = dy / dist;
    player.x = ball.x + nx * minDist;
    player.y = ball.y + ny * minDist;
    const vn = player.vx * nx + player.vy * ny;
    if (vn < 0) {
      player.vx -= vn * nx;
      player.vy -= vn * ny;
    }
  }
};

/** Advances the ball by one physics substep and resolves every contact. */
export const stepBallSubstep = (state: SimState, dt: number, walls: WallDef[]): void => {
  const { ball } = state;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  collideBallWithTrails(state);
  collideBallWithBars(state);
  collideBallWithBodies(state);
  collideBallWithWalls(state, walls);
  unpinPlayers(state);
  clampBallSpeed(state);
};

/** Returns the team whose goal the ball has fully entered, or null. */
export const detectGoal = (state: SimState): number | null => {
  const { ball } = state;
  for (const goal of state.arena.goals) {
    if (state.closedGoals.includes(goal.team)) continue;
    const depth = (ball.x - goal.mouth.ax) * goal.inwardX + (ball.y - goal.mouth.ay) * goal.inwardY;
    if (depth < -BALL_RADIUS) return goal.team;
  }
  return null;
};
