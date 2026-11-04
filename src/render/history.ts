import type { RenderFrame } from "@/types/render";
import { POWER_TRAIL_LIFETIME, TRAIL_BREAK_DISTANCE } from "@/game/constants";

export interface HistoryPlayer {
  id: string;
  team: number;
  x: number;
  y: number;
  dashing: boolean;
  eliminated: boolean;
}

export interface HistoryFrame {
  time: number;
  ballX: number;
  ballY: number;
  players: HistoryPlayer[];
}

export interface TrailSample {
  x: number;
  y: number;
  age: number;
  power: boolean;
  /** True when this sample starts a new stroke (gap before it). */
  breakBefore: boolean;
}

const KEEP_SECONDS = 6;
const MIN_SAMPLE_GAP = 1 / 120;

/**
 * Recent positions of everything on the field. Trails are drawn from it and
 * it doubles as the buffer for goal replays.
 */
export class FrameHistory {
  private frames: HistoryFrame[] = [];

  clear(): void {
    this.frames = [];
  }

  push(frame: RenderFrame): void {
    const last = this.frames[this.frames.length - 1];
    if (last && frame.time < last.time - 0.5) this.frames = [];
    if (last && frame.time - last.time < MIN_SAMPLE_GAP) return;
    this.frames.push({
      time: frame.time,
      ballX: frame.ball.x,
      ballY: frame.ball.y,
      players: frame.players.map((p) => ({ id: p.id, team: p.team, x: p.x, y: p.y, dashing: p.dashing, eliminated: p.eliminated })),
    });
    const cutoff = frame.time - KEEP_SECONDS;
    let drop = 0;
    while (drop < this.frames.length && this.frames[drop].time < cutoff) drop += 1;
    if (drop > 0) this.frames.splice(0, drop);
  }

  /** The recorded frame closest to (and not after) the given time. */
  at(time: number): HistoryFrame | null {
    let found: HistoryFrame | null = null;
    for (const frame of this.frames) {
      if (frame.time > time) break;
      found = frame;
    }
    return found ?? this.frames[0] ?? null;
  }

  span(): [number, number] | null {
    if (this.frames.length === 0) return null;
    return [this.frames[0].time, this.frames[this.frames.length - 1].time];
  }

  /** Trail samples for one player as seen at `time`, oldest first. */
  trail(playerId: string, time: number, lifetime: number): TrailSample[] {
    const samples: TrailSample[] = [];
    let prevX = Number.NaN;
    let prevY = Number.NaN;
    const from = time - Math.max(lifetime, POWER_TRAIL_LIFETIME);
    for (const frame of this.frames) {
      if (frame.time < from) continue;
      if (frame.time > time) break;
      const p = frame.players.find((q) => q.id === playerId);
      if (!p || p.eliminated) continue;
      const age = time - frame.time;
      if (age > lifetime && !(p.dashing && age <= POWER_TRAIL_LIFETIME)) {
        prevX = Number.NaN;
        continue;
      }
      const gap = Number.isNaN(prevX) || Math.hypot(p.x - prevX, p.y - prevY) > TRAIL_BREAK_DISTANCE;
      samples.push({ x: p.x, y: p.y, age, power: p.dashing, breakBefore: gap });
      prevX = p.x;
      prevY = p.y;
    }
    return samples;
  }
}
