import { ArenaEventKind, ArenaEventStage, GameEventKind, type ArenaDef, type Segment, type SimState } from "@/types/game";
import { ARENA_EVENT_SECONDS, BALL_RADIUS, BALL_WALL_RESTITUTION } from "@/game/constants";
import { pushEvent } from "@/game/events";
import { circleSegmentHit } from "@/game/physics";

export interface MovingBar extends Segment {
  /** Vertical speed of the bar, used to push the ball along with it. */
  vy: number;
}

export interface ArenaEventView {
  kind: ArenaEventKind | null;
  stage: ArenaEventStage;
  timer: number;
}

export const BAR_HALF_WIDTH = 7;
const BAR_X_FRACTIONS = [0.36, 0.64] as const;
const BAR_HALF_LENGTH = 0.13;
const BAR_SWING = 0.26;
const BAR_PERIOD_SECONDS = 4;
const HIT_EVENT_MIN_SPEED = 260;

/** Two neon bars swinging up and down across midfield. They block the ball only, players pass through. */
export const movingBars = (arena: ArenaDef, ev: ArenaEventView): MovingBar[] => {
  if (ev.kind !== ArenaEventKind.MovingWalls || ev.stage === ArenaEventStage.Idle) return [];
  const elapsed = ev.stage === ArenaEventStage.Active ? ARENA_EVENT_SECONDS[ArenaEventKind.MovingWalls] - ev.timer : 0;
  const omega = (Math.PI * 2) / BAR_PERIOD_SECONDS;
  return BAR_X_FRACTIONS.map((fx, i) => {
    const phase = elapsed * omega + i * Math.PI;
    const cy = arena.height / 2 + Math.sin(phase) * arena.height * BAR_SWING;
    const half = arena.height * BAR_HALF_LENGTH;
    const x = arena.width * fx;
    return { ax: x, ay: cy - half, bx: x, by: cy + half, vy: Math.cos(phase) * omega * arena.height * BAR_SWING };
  });
};

export const collideBallWithBars = (state: SimState): void => {
  if (state.arenaEvent.stage !== ArenaEventStage.Active) return;
  const { ball } = state;
  for (const bar of movingBars(state.arena, state.arenaEvent)) {
    const hit = circleSegmentHit(ball.x, ball.y, BALL_RADIUS, bar, BAR_HALF_WIDTH, ball.vx, ball.vy - bar.vy);
    if (!hit) continue;
    ball.x = hit.qx + hit.nx * (BALL_RADIUS + BAR_HALF_WIDTH + 0.01);
    ball.y = hit.qy + hit.ny * (BALL_RADIUS + BAR_HALF_WIDTH + 0.01);
    const rel = ball.vx * hit.nx + (ball.vy - bar.vy) * hit.ny;
    if (rel >= 0) continue;
    ball.vx -= (1 + BALL_WALL_RESTITUTION) * rel * hit.nx;
    ball.vy -= (1 + BALL_WALL_RESTITUTION) * rel * hit.ny;
    if (-rel > HIT_EVENT_MIN_SPEED) pushEvent(state, { kind: GameEventKind.WallHit, x: ball.x, y: ball.y, value: -rel });
  }
};
