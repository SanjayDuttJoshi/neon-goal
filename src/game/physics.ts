import type { Segment, WallDef } from "@/types/game";
import { closestPointOnSegment } from "@/game/vector";

export interface SegmentHit {
  nx: number;
  ny: number;
  depth: number;
  qx: number;
  qy: number;
}

/**
 * Overlap test between a circle and a capsule (segment with half width).
 * The normal points from the segment towards the circle centre. When the
 * centre lies exactly on the segment, the normal opposes the hint velocity.
 */
export const circleSegmentHit = (
  cx: number,
  cy: number,
  radius: number,
  seg: Segment,
  halfWidth: number,
  hintVx = 0,
  hintVy = 0,
): SegmentHit | null => {
  const q = closestPointOnSegment(cx, cy, seg);
  const dx = cx - q.x;
  const dy = cy - q.y;
  const dist = Math.hypot(dx, dy);
  const reach = radius + halfWidth;
  if (dist >= reach) return null;
  let nx: number;
  let ny: number;
  if (dist > 1e-6) {
    nx = dx / dist;
    ny = dy / dist;
  } else {
    const sx = seg.bx - seg.ax;
    const sy = seg.by - seg.ay;
    const sLen = Math.hypot(sx, sy);
    nx = sLen > 1e-9 ? -sy / sLen : 0;
    ny = sLen > 1e-9 ? sx / sLen : -1;
    if (nx * hintVx + ny * hintVy > 0) {
      nx = -nx;
      ny = -ny;
    }
  }
  return { nx, ny, depth: reach - dist, qx: q.x, qy: q.y };
};

export interface Velocity {
  vx: number;
  vy: number;
}

/** Reflects a velocity off a surface normal if it moves into the surface. */
export const bounceVelocity = (
  vx: number,
  vy: number,
  nx: number,
  ny: number,
  restitution: number,
): Velocity | null => {
  const vn = vx * nx + vy * ny;
  if (vn >= 0) return null;
  return { vx: vx - (1 + restitution) * vn * nx, vy: vy - (1 + restitution) * vn * ny };
};

/** Pushes a circle out of a static surface and removes inward velocity. */
export const slideOffSurface = <T extends { x: number; y: number; vx: number; vy: number }>(
  body: T,
  hit: SegmentHit,
): void => {
  body.x += hit.nx * hit.depth;
  body.y += hit.ny * hit.depth;
  const vn = body.vx * hit.nx + body.vy * hit.ny;
  if (vn < 0) {
    body.vx -= vn * hit.nx;
    body.vy -= vn * hit.ny;
  }
};

/** How far behind a wall a body may be and still get pushed back in. */
const MAX_BEHIND_WALL = 80;

/**
 * One-sided contact against a static wall. Bodies that slipped behind the
 * wall line are pushed back to the playable side, and segment endpoints act
 * as round posts.
 */
export const wallContact = (cx: number, cy: number, radius: number, wall: WallDef): SegmentHit | null => {
  const dx = wall.bx - wall.ax;
  const dy = wall.by - wall.ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 1e-9 ? ((cx - wall.ax) * dx + (cy - wall.ay) * dy) / lenSq : 0;
  if (t >= 0 && t <= 1) {
    const d = (cx - wall.ax) * wall.nx + (cy - wall.ay) * wall.ny;
    if (d >= radius || d < -MAX_BEHIND_WALL) return null;
    return { nx: wall.nx, ny: wall.ny, depth: radius - d, qx: wall.ax + dx * t, qy: wall.ay + dy * t };
  }
  const ex = t < 0 ? wall.ax : wall.bx;
  const ey = t < 0 ? wall.ay : wall.by;
  const ox = cx - ex;
  const oy = cy - ey;
  const dist = Math.hypot(ox, oy);
  if (dist >= radius) return null;
  if (dist < 1e-6) return { nx: wall.nx, ny: wall.ny, depth: radius, qx: ex, qy: ey };
  return { nx: ox / dist, ny: oy / dist, depth: radius - dist, qx: ex, qy: ey };
};
