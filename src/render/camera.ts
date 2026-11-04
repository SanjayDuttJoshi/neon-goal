import type { ArenaDef, Vec2 } from "@/types/game";
import { ARENA_VIEW_MARGIN } from "@/game/arena";

/** Padding on sides that have no goal net behind them. */
const SIDE_VIEW_MARGIN = 28;

const marginFor = (arena: ArenaDef, axis: "x" | "y"): number =>
  arena.goals.some((g) => Math.abs(axis === "x" ? g.inwardX : g.inwardY) > 0.5) ? ARENA_VIEW_MARGIN : SIDE_VIEW_MARGIN;

export interface ViewInsets {
  top: number;
  bottom: number;
  side: number;
}

/**
 * Maps world coordinates to the screen. On portrait screens the field is
 * rotated so it fills the phone, and the field can be mirrored so your own
 * goal is always on the left (or bottom).
 */
export class Camera {
  scale = 1;
  centerX = 0;
  centerY = 0;
  rotated = false;
  flipped = false;
  shakeX = 0;
  shakeY = 0;
  private arenaW = 1;
  private arenaH = 1;

  fit(arena: ArenaDef, width: number, height: number, insets: ViewInsets, flipped: boolean): void {
    this.arenaW = arena.width;
    this.arenaH = arena.height;
    this.flipped = flipped;
    this.rotated = height > width * 1.08;
    const availW = Math.max(50, width - insets.side * 2);
    const availH = Math.max(50, height - insets.top - insets.bottom);
    const worldW = arena.width + marginFor(arena, "x") * 2;
    const worldH = arena.height + marginFor(arena, "y") * 2;
    const [spanW, spanH] = this.rotated ? [worldH, worldW] : [worldW, worldH];
    this.scale = Math.min(availW / spanW, availH / spanH);
    this.centerX = width / 2;
    this.centerY = insets.top + availH / 2;
  }

  /** Applies the world transform to a 2D context (call inside save/restore). */
  apply(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.centerX + this.shakeX, this.centerY + this.shakeY);
    if (this.rotated) ctx.rotate(-Math.PI / 2);
    ctx.scale(this.flipped ? -this.scale : this.scale, this.scale);
    ctx.translate(-this.arenaW / 2, -this.arenaH / 2);
  }

  worldToScreen(x: number, y: number): Vec2 {
    let dx = (x - this.arenaW / 2) * this.scale;
    const dy = (y - this.arenaH / 2) * this.scale;
    if (this.flipped) dx = -dx;
    if (this.rotated) return { x: this.centerX + this.shakeX + dy, y: this.centerY + this.shakeY - dx };
    return { x: this.centerX + this.shakeX + dx, y: this.centerY + this.shakeY + dy };
  }

  /** Converts a direction pressed on screen into the matching world direction. */
  screenDirToWorld(sx: number, sy: number): Vec2 {
    let wx = this.rotated ? -sy : sx;
    const wy = this.rotated ? sx : sy;
    if (this.flipped) wx = -wx;
    return { x: wx, y: wy };
  }
}
