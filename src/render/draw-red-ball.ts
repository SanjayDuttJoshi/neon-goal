import type { RenderBall, RenderPlayer } from "@/types/render";
import { BALL_RADIUS, PLAYER_RADIUS, RED_TOUCHES, TEAM_COLORS } from "@/game/constants";
import { withAlpha } from "@/render/colors";

export const RED_BALL_COLOR = "#ef4444";
const HEAT_COLOR = "#fb923c";
const DOT_ORBIT = BALL_RADIUS + 9;

/** Glow color for the ball: icy blue, warming to orange, then red. */
export const ballTint = (ball: RenderBall): string | null => {
  if (ball.redLeft > 0) return RED_BALL_COLOR;
  if (ball.heat >= 0.5) return HEAT_COLOR;
  return null;
};

/** Heat arc while warming up; flames plus a ring of remaining red touches while red. */
export const drawBallHeat = (ctx: CanvasRenderingContext2D, ball: RenderBall, time: number): void => {
  ctx.save();
  ctx.lineCap = "round";
  if (ball.redLeft > 0) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2 + time * 5;
      const flicker = 0.6 + 0.4 * Math.sin(time * 23 + i * 2);
      ctx.fillStyle = withAlpha(i % 2 ? "#f97316" : RED_BALL_COLOR, 0.35 * flicker);
      ctx.beginPath();
      ctx.arc(ball.x + Math.cos(a) * 6, ball.y + Math.sin(a) * 6, BALL_RADIUS * (1.15 + 0.35 * flicker), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < RED_TOUCHES; i += 1) {
      const a = -Math.PI / 2 + (i / RED_TOUCHES) * Math.PI * 2;
      ctx.fillStyle = i < ball.redLeft ? "#fecaca" : "rgba(127, 29, 29, 0.6)";
      ctx.beginPath();
      ctx.arc(ball.x + Math.cos(a) * DOT_ORBIT, ball.y + Math.sin(a) * DOT_ORBIT, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ball.heat > 0) {
    ctx.strokeStyle = withAlpha(HEAT_COLOR, 0.35 + 0.5 * ball.heat);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, DOT_ORBIT, -Math.PI / 2, -Math.PI / 2 + ball.heat * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

/** A knocked-out player: a dashed ring where they burned (the countdown is drawn with the labels). */
export const drawOutGhost = (ctx: CanvasRenderingContext2D, p: RenderPlayer, time: number): void => {
  const color = TEAM_COLORS[p.team] ?? "#ffffff";
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineDashOffset = time * 20;
  ctx.strokeStyle = withAlpha(color, 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

/** Bubble shown during the short shield after coming back. */
export const drawShield = (ctx: CanvasRenderingContext2D, p: RenderPlayer, time: number): void => {
  ctx.save();
  ctx.strokeStyle = withAlpha("#e0f2fe", 0.5 + 0.3 * Math.sin(time * 16));
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RADIUS + 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};
