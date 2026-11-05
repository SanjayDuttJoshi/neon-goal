import type { ArenaDef, Segment } from "@/types/game";
import { TEAM_COLORS } from "@/game/constants";
import { lighten, withAlpha } from "@/render/colors";

const GRID_STEP = 50;
const WALL_COLOR = "#7dd3fc";
const CENTER_RADIUS = 90;

export const fieldPath = (ctx: CanvasRenderingContext2D, arena: ArenaDef): void => {
  const { width: w, height: h } = arena;
  const corner = arena.walls.find((wall) => wall.ax === 0 && wall.bx !== 0 && wall.by === 0);
  const c = corner ? corner.bx : 0;
  ctx.beginPath();
  ctx.moveTo(c, 0);
  ctx.lineTo(w - c, 0);
  ctx.lineTo(w, c);
  ctx.lineTo(w, h - c);
  ctx.lineTo(w - c, h);
  ctx.lineTo(c, h);
  ctx.lineTo(0, h - c);
  ctx.lineTo(0, c);
  ctx.closePath();
};

const strokeSegments = (ctx: CanvasRenderingContext2D, segments: Segment[]): void => {
  ctx.beginPath();
  for (const s of segments) {
    ctx.moveTo(s.ax, s.ay);
    ctx.lineTo(s.bx, s.by);
  }
  ctx.stroke();
};

/** Three stacked strokes give a cheap neon glow without shadowBlur. */
export const neonStroke = (
  ctx: CanvasRenderingContext2D,
  draw: () => void,
  color: string,
  width: number,
  intensity = 1,
): void => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const passes: Array<[number, number, string]> = [
    [width * 5, 0.07 * intensity, color],
    [width * 2.4, 0.22 * intensity, color],
    [width, 0.9 * intensity, lighten(color, 0.6)],
  ];
  for (const [lineWidth, alpha, stroke] of passes) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.globalAlpha = Math.min(1, alpha);
    draw();
  }
  ctx.restore();
};

export const drawField = (ctx: CanvasRenderingContext2D, arena: ArenaDef, closedGoals: number[], time: number): void => {
  const { width: w, height: h } = arena;
  ctx.save();
  fieldPath(ctx, arena);
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#071027");
  gradient.addColorStop(0.5, "#050a1c");
  gradient.addColorStop(1, "#0b0920");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = GRID_STEP; x < w; x += GRID_STEP) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = GRID_STEP; y < h; y += GRID_STEP) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  const scan = ((time * 120) % (h + 200)) - 100;
  const sweep = ctx.createLinearGradient(0, scan - 80, 0, scan + 80);
  sweep.addColorStop(0, "rgba(56,189,248,0)");
  sweep.addColorStop(0.5, "rgba(56,189,248,0.05)");
  sweep.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(0, scan - 80, w, 160);
  ctx.restore();

  const lineColor = "rgba(148, 163, 184, 0.22)";
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 3;
  if (arena.teamCount === 2) {
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, CENTER_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = lineColor;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  for (const goal of arena.goals) {
    const color = TEAM_COLORS[goal.team] ?? WALL_COLOR;
    const closed = closedGoals.includes(goal.team);
    ctx.save();
    ctx.strokeStyle = withAlpha(color, 0.16);
    ctx.lineWidth = 3;
    ctx.beginPath();
    const facing = Math.atan2(goal.inwardY, goal.inwardX);
    ctx.arc(goal.centerX, goal.centerY, 170, facing - Math.PI / 2, facing + Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = withAlpha(color, closed ? 0.03 : 0.1);
    ctx.beginPath();
    const [a, b, c] = goal.netWalls;
    ctx.moveTo(a.ax, a.ay);
    ctx.lineTo(b.ax, b.ay);
    ctx.lineTo(c.ax, c.ay);
    ctx.lineTo(c.bx, c.by);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    neonStroke(ctx, () => strokeSegments(ctx, goal.netWalls), color, 2.5, closed ? 0.3 : 0.8);
    const pulse = 0.75 + Math.sin(time * 4 + goal.team) * 0.25;
    neonStroke(ctx, () => strokeSegments(ctx, [goal.mouth]), closed ? "#ef4444" : color, closed ? 6 : 3, closed ? 1 : pulse);
  }
  neonStroke(ctx, () => strokeSegments(ctx, arena.walls), WALL_COLOR, 3, 1);
};
