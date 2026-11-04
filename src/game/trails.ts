import type { PlayerState, Segment, TrailPoint } from "@/types/game";
import {
  POWER_TRAIL_LIFETIME,
  TRAIL_ACTIVATION_DELAY,
  TRAIL_BREAK_DISTANCE,
  TRAIL_EMIT_DISTANCE,
  TRAIL_EMIT_MAX_INTERVAL,
  TRAIL_LIFETIME,
  TRAIL_MAX_POINTS,
  TRAIL_MIN_SPEED,
} from "@/game/constants";

export const trailLifetime = (point: TrailPoint): number =>
  point.power ? POWER_TRAIL_LIFETIME : TRAIL_LIFETIME;

/** Appends a trail point when the player moved far enough or enough time passed. */
export const emitTrailPoint = (trail: TrailPoint[], x: number, y: number, speed: number, time: number, power: boolean): void => {
  if (speed < TRAIL_MIN_SPEED) return;
  const last = trail[trail.length - 1];
  if (last) {
    const moved = Math.hypot(x - last.x, y - last.y);
    const elapsed = time - last.t;
    if (moved < TRAIL_EMIT_DISTANCE && elapsed < TRAIL_EMIT_MAX_INTERVAL) return;
    if (moved < 0.5) return;
  }
  trail.push({ x, y, t: time, power });
  if (trail.length > TRAIL_MAX_POINTS) trail.splice(0, trail.length - TRAIL_MAX_POINTS);
};

export const expireTrail = (trail: TrailPoint[], time: number): void => {
  let firstAlive = 0;
  while (firstAlive < trail.length && time - trail[firstAlive].t > trailLifetime(trail[firstAlive])) {
    firstAlive += 1;
  }
  if (firstAlive > 0) trail.splice(0, firstAlive);
};

export interface TrailSegment {
  seg: Segment;
  power: boolean;
}

/**
 * Calls back for every collidable segment of a player's trail. Points that are
 * still under the player's body (younger than the activation delay) are
 * skipped, and long gaps (e.g. after a reset) never form a segment.
 */
export const forEachActiveSegment = (
  player: PlayerState,
  time: number,
  visit: (segment: TrailSegment) => boolean | void,
): void => {
  const trail = player.trail;
  for (let i = 0; i < trail.length - 1; i += 1) {
    const a = trail[i];
    const b = trail[i + 1];
    if (time - b.t < TRAIL_ACTIVATION_DELAY) return;
    if (Math.hypot(b.x - a.x, b.y - a.y) > TRAIL_BREAK_DISTANCE) continue;
    const stop = visit({ seg: { ax: a.x, ay: a.y, bx: b.x, by: b.y }, power: a.power || b.power });
    if (stop === true) return;
  }
};
