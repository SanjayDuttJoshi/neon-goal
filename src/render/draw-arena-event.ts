import { ArenaEventKind, ArenaEventStage, type ArenaDef } from "@/types/game";
import type { RenderArenaEvent } from "@/types/render";
import { BAR_HALF_WIDTH, movingBars } from "@/game/moving-walls";
import { ARENA_EVENT_INFO } from "@/lib/arena-event-info";
import { withAlpha } from "@/render/colors";
import { fieldPath } from "@/render/draw-field";

const ICE_SPARKLES = 70;

const isActive = (ev: RenderArenaEvent, kind: ArenaEventKind): boolean => ev.kind === kind && ev.stage === ArenaEventStage.Active;

/** Deterministic pseudo-random in [0, 1) so the frost pattern doesn't flicker. */
const hash = (n: number): number => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

const drawIce = (ctx: CanvasRenderingContext2D, arena: ArenaDef, time: number): void => {
  ctx.fillStyle = "rgba(125, 211, 252, 0.2)";
  ctx.fillRect(0, 0, arena.width, arena.height);
  ctx.fillStyle = "#e0f2fe";
  for (let i = 0; i < ICE_SPARKLES; i += 1) {
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(time * 2 + i));
    ctx.fillRect(hash(i) * arena.width, hash(i + 99) * arena.height, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;
};

const strokeBorder = (ctx: CanvasRenderingContext2D, arena: ArenaDef, color: string, alpha: number, width: number): void => {
  fieldPath(ctx, arena);
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
};

/** Floor tints and border pulses for the current event, drawn right after the field. */
export const drawArenaEventFloor = (ctx: CanvasRenderingContext2D, arena: ArenaDef, ev: RenderArenaEvent, time: number): void => {
  if (!ev.kind || ev.stage === ArenaEventStage.Idle) return;
  const color = ARENA_EVENT_INFO[ev.kind].color;
  ctx.save();
  fieldPath(ctx, arena);
  ctx.clip();
  if (isActive(ev, ArenaEventKind.Ice)) drawIce(ctx, arena, time);
  if (isActive(ev, ArenaEventKind.GoldenTime)) {
    ctx.fillStyle = withAlpha(color, 0.05 + 0.03 * Math.sin(time * 6));
    ctx.fillRect(0, 0, arena.width, arena.height);
  }
  ctx.restore();
  ctx.save();
  if (ev.stage === ArenaEventStage.Warning) {
    const blink = 0.5 + 0.5 * Math.sin(time * 14);
    strokeBorder(ctx, arena, color, 0.25 + 0.6 * blink, 10);
  } else if (isActive(ev, ArenaEventKind.Ice)) {
    strokeBorder(ctx, arena, "#e0f2fe", 0.55, 8);
  } else if (isActive(ev, ArenaEventKind.GoldenTime)) {
    strokeBorder(ctx, arena, color, 0.35, 16);
    strokeBorder(ctx, arena, "#fef08a", 0.9, 4);
  }
  ctx.restore();
};

/** The swinging bars: dashed ghosts during the warning, solid neon while live. */
export const drawMovingBars = (ctx: CanvasRenderingContext2D, arena: ArenaDef, ev: RenderArenaEvent, time: number): void => {
  const bars = movingBars(arena, ev);
  if (bars.length === 0) return;
  const live = ev.stage === ArenaEventStage.Active;
  const color = ARENA_EVENT_INFO[ArenaEventKind.MovingWalls].color;
  ctx.save();
  ctx.lineCap = "round";
  for (const bar of bars) {
    if (!live) {
      ctx.setLineDash([10, 10]);
      ctx.lineDashOffset = -time * 30;
      ctx.strokeStyle = withAlpha(color, 0.6);
      ctx.lineWidth = BAR_HALF_WIDTH * 2;
    }
    const passes = live ? [[BAR_HALF_WIDTH * 4, 0.15], [BAR_HALF_WIDTH * 2, 0.5], [BAR_HALF_WIDTH * 0.8, 1]] : [[BAR_HALF_WIDTH * 2, 0.6]];
    for (const [width, alpha] of passes) {
      ctx.strokeStyle = alpha === 1 ? "#fdf4ff" : withAlpha(color, alpha);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(bar.ax, bar.ay);
      ctx.lineTo(bar.bx, bar.by);
      ctx.stroke();
    }
  }
  ctx.restore();
};

export const isBlackout = (ev: RenderArenaEvent): boolean => isActive(ev, ArenaEventKind.Blackout);
