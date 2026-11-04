import type { TrailSample } from "@/render/history";
import { lighten } from "@/render/colors";
import { TRAIL_LIFETIME } from "@/game/constants";

const ALPHA_BANDS = 6;

interface Band {
  segments: number[];
  power: boolean;
}

/**
 * Draws one player's trail. Segments are grouped into a few alpha bands so a
 * long glowing trail costs only a handful of strokes.
 */
export const drawTrail = (ctx: CanvasRenderingContext2D, samples: TrailSample[], color: string): void => {
  if (samples.length < 2) return;
  const bands: Band[] = Array.from({ length: ALPHA_BANDS * 2 }, (_, i) => ({ segments: [], power: i >= ALPHA_BANDS }));
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    if (b.breakBefore) continue;
    const life = Math.max(0, 1 - b.age / TRAIL_LIFETIME);
    const power = a.power || b.power;
    const fade = power ? Math.max(life, 0.35 * Math.max(0, 1 - b.age / 2.2)) : life;
    if (fade <= 0.01) continue;
    const band = Math.min(ALPHA_BANDS - 1, Math.floor(fade * ALPHA_BANDS));
    bands[band + (power ? ALPHA_BANDS : 0)].segments.push(a.x, a.y, b.x, b.y);
  }
  const core = lighten(color, 0.55);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  bands.forEach((band, index) => {
    if (band.segments.length === 0) return;
    const level = ((index % ALPHA_BANDS) + 1) / ALPHA_BANDS;
    const widthScale = band.power ? 1.7 : 1;
    const path = new Path2D();
    for (let i = 0; i < band.segments.length; i += 4) {
      path.moveTo(band.segments[i], band.segments[i + 1]);
      path.lineTo(band.segments[i + 2], band.segments[i + 3]);
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.1 * level;
    ctx.lineWidth = 22 * widthScale;
    ctx.stroke(path);
    ctx.globalAlpha = 0.35 * level;
    ctx.lineWidth = 9 * widthScale;
    ctx.stroke(path);
    ctx.strokeStyle = band.power ? "#ffffff" : core;
    ctx.globalAlpha = 0.95 * level;
    ctx.lineWidth = 3.2 * widthScale;
    ctx.stroke(path);
  });
  ctx.restore();
};
