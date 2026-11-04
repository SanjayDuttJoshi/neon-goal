import type { Segment, Vec2 } from "@/types/game";

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const length = (x: number, y: number): number => Math.hypot(x, y);

export const normalize = (x: number, y: number): Vec2 => {
  const len = Math.hypot(x, y);
  if (len < 1e-9) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
};

export interface ClosestPoint {
  x: number;
  y: number;
  /** Parameter along the segment, 0 at a and 1 at b. */
  t: number;
}

export const closestPointOnSegment = (px: number, py: number, seg: Segment): ClosestPoint => {
  const dx = seg.bx - seg.ax;
  const dy = seg.by - seg.ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return { x: seg.ax, y: seg.ay, t: 0 };
  const t = clamp(((px - seg.ax) * dx + (py - seg.ay) * dy) / lenSq, 0, 1);
  return { x: seg.ax + dx * t, y: seg.ay + dy * t, t };
};

export const distanceToSegment = (px: number, py: number, seg: Segment): number => {
  const q = closestPointOnSegment(px, py, seg);
  return Math.hypot(px - q.x, py - q.y);
};

/** Distance along a ray (origin + dir * d) to a segment, or null if it misses. */
export const raySegmentDistance = (
  ox: number,
  oy: number,
  dirX: number,
  dirY: number,
  seg: Segment,
): number | null => {
  const sx = seg.bx - seg.ax;
  const sy = seg.by - seg.ay;
  const denom = dirX * sy - dirY * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const qx = seg.ax - ox;
  const qy = seg.ay - oy;
  const d = (qx * sy - qy * sx) / denom;
  const u = (qx * dirY - qy * dirX) / denom;
  if (d < 0 || u < 0 || u > 1) return null;
  return d;
};

export const makeSegment = (ax: number, ay: number, bx: number, by: number): Segment => ({
  ax,
  ay,
  bx,
  by,
});

/** Deterministic PRNG (mulberry32). Returns [value in 0..1, next state]. */
export const nextRandom = (state: number): [number, number] => {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
};

export const isFiniteNumber = (value: number): boolean => Number.isFinite(value);
