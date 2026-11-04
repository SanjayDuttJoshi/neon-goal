import { canvasFonts } from "@/render/fonts";

const STAR_COUNT = 90;

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
}

const STARS: Star[] = Array.from({ length: STAR_COUNT }, (_, i) => {
  const seed = Math.sin(i * 12.9898) * 43758.5453;
  const frac = (v: number) => v - Math.floor(v);
  return { x: frac(seed), y: frac(seed * 1.7), r: 0.4 + frac(seed * 3.1) * 1.3, phase: frac(seed * 5.3) * Math.PI * 2 };
});

/** Deep space backdrop with a soft vignette and twinkling stars. */
export const drawBackdrop = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number): void => {
  ctx.fillStyle = "#02030a";
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width / 2, height * 0.55, 0, width / 2, height * 0.55, Math.max(width, height) * 0.75);
  glow.addColorStop(0, "rgba(30, 27, 75, 0.55)");
  glow.addColorStop(0.6, "rgba(8, 47, 73, 0.18)");
  glow.addColorStop(1, "rgba(2, 3, 10, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#e0f2fe";
  for (const star of STARS) {
    ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 1.3 + star.phase));
    ctx.beginPath();
    ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

/** Cinematic letterbox and a blinking REPLAY tag. */
export const drawReplayOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number): void => {
  const bar = Math.max(18, height * 0.07);
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(0, 0, width, bar);
  ctx.fillRect(0, height - bar, width, bar);
  ctx.font = `700 16px ${canvasFonts().display}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = Math.sin(time * 6) > 0 ? "#f43f5e" : "rgba(244, 63, 94, 0.35)";
  ctx.beginPath();
  ctx.arc(24, height - bar / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f8fafc";
  ctx.fillText("REPLAY", 38, height - bar / 2 + 1);
  ctx.restore();
};
