import type { RenderBall, RenderPlayer } from "@/types/render";
import { BALL_RADIUS, PLAYER_RADIUS, TEAM_COLORS } from "@/game/constants";
import { lighten, withAlpha } from "@/render/colors";
import type { Camera } from "@/render/camera";
import { canvasFonts } from "@/render/fonts";

const GHOSTS = 5;

export const drawBall = (ctx: CanvasRenderingContext2D, ball: RenderBall, time: number): void => {
  const speed = Math.hypot(ball.vx, ball.vy);
  const hot = Math.min(1, Math.max(0, (speed - 500) / 600));
  const glowColor = hot > 0.3 ? "#fb923c" : "#e0f2fe";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (speed > 250) {
    for (let i = GHOSTS; i >= 1; i -= 1) {
      const back = (i / GHOSTS) * Math.min(0.09, 40 / speed) * 1.4;
      ctx.globalAlpha = 0.12 * (1 - i / (GHOSTS + 1));
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(ball.x - ball.vx * back, ball.y - ball.vy * back, BALL_RADIUS * (1 - i * 0.08), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const pulse = 1 + Math.sin(time * 10) * 0.05;
  const glow = ctx.createRadialGradient(ball.x, ball.y, BALL_RADIUS * 0.4, ball.x, ball.y, BALL_RADIUS * 3.6 * pulse);
  glow.addColorStop(0, withAlpha(hot > 0.3 ? "#fdba74" : "#bae6fd", 0.75));
  glow.addColorStop(1, "rgba(14, 165, 233, 0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS * 3.6 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  const core = ctx.createRadialGradient(ball.x - 4, ball.y - 4, 2, ball.x, ball.y, BALL_RADIUS);
  core.addColorStop(0, "#ffffff");
  core.addColorStop(1, hot > 0.3 ? "#fed7aa" : "#bae6fd");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const drawPlayer = (ctx: CanvasRenderingContext2D, p: RenderPlayer, time: number): void => {
  if (p.eliminated) return;
  const color = TEAM_COLORS[p.team] ?? "#ffffff";
  const r = PLAYER_RADIUS;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glowR = r * (p.dashing ? 3.4 : 2.6);
  const glow = ctx.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, glowR);
  glow.addColorStop(0, withAlpha(color, p.dashing ? 0.7 : 0.45));
  glow.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#060914";
  ctx.strokeStyle = lighten(color, p.isSelf ? 0.35 : 0.1);
  ctx.lineWidth = p.isSelf ? 5 : 4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = withAlpha(color, 0.85);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > 30) {
    const ang = Math.atan2(p.vy, p.vx);
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.fillStyle = lighten(color, 0.5);
    ctx.beginPath();
    ctx.moveTo(r + 9, 0);
    ctx.lineTo(r + 1, -6);
    ctx.lineTo(r + 1, 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (p.isSelf) {
    ctx.save();
    ctx.strokeStyle = withAlpha("#ffffff", 0.85);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const ready = Math.max(0, Math.min(1, p.dashReady));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ready);
    ctx.stroke();
    if (ready >= 1) {
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -time * 40;
      ctx.strokeStyle = withAlpha(color, 0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (p.slowed) {
    ctx.save();
    ctx.strokeStyle = "#93c5fd";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + time * 9;
      ctx.moveTo(p.x + Math.cos(a) * (r + 3), p.y + Math.sin(a) * (r + 3));
      ctx.lineTo(p.x + Math.cos(a + 0.3) * (r + 11), p.y + Math.sin(a + 0.3) * (r + 11));
    }
    ctx.stroke();
    ctx.restore();
  }
};

/** Names are drawn in screen space so they stay upright on rotated fields. */
export const drawLabels = (ctx: CanvasRenderingContext2D, players: RenderPlayer[], camera: Camera): void => {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const fontSize = Math.max(10, Math.min(14, 11 + camera.scale * 3));
  ctx.font = `700 ${fontSize + 2}px ${canvasFonts().body}`;
  const offset = (PLAYER_RADIUS + 14) * camera.scale + 6;
  for (const p of players) {
    if (p.eliminated) continue;
    const s = camera.worldToScreen(p.x, p.y);
    const label = p.isSelf ? `▼ ${p.name}` : p.name;
    ctx.globalAlpha = p.isBot && !p.isSelf ? 0.6 : 0.95;
    ctx.fillStyle = "rgba(2, 6, 23, 0.7)";
    const width = ctx.measureText(label).width + 10;
    ctx.fillRect(s.x - width / 2, s.y - offset - fontSize - 2, width, fontSize + 5);
    ctx.fillStyle = p.isSelf ? "#ffffff" : lighten(TEAM_COLORS[p.team] ?? "#ffffff", 0.35);
    ctx.fillText(label, s.x, s.y - offset + 2);
  }
  ctx.restore();
};
