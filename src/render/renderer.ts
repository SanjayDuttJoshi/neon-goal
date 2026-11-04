import { GameEventKind, GameMode, MatchPhase, type GameEvent } from "@/types/game";
import type { RenderFrame, RenderPlayer } from "@/types/render";
import { TEAM_COLORS, TRAIL_LIFETIME } from "@/game/constants";
import { Camera, type ViewInsets } from "@/render/camera";
import { drawBall, drawLabels, drawPlayer } from "@/render/draw-entities";
import { drawField } from "@/render/draw-field";
import { drawTrail } from "@/render/draw-trails";
import { spawnEffect, type EffectState } from "@/render/effects";
import { FrameHistory } from "@/render/history";
import { ParticleSystem } from "@/render/particles";
import { drawBackdrop, drawReplayOverlay } from "@/render/overlays";

export interface RenderOptions {
  selfTeam: number | null;
  mode: GameMode;
  insets: ViewInsets;
}

const REPLAY_DELAY_MS = 900;
const REPLAY_LEAD_SECONDS = 1.7;
const REPLAY_TAIL_SECONDS = 0.3;
const REPLAY_SPEED = 0.55;

interface ReplayState {
  goalTime: number;
  startMs: number;
}

/** Draws the arena, trails, players, ball and effects onto a canvas. */
export class NeonRenderer {
  readonly camera = new Camera();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly history = new FrameHistory();
  private readonly particles = new ParticleSystem();
  private readonly effects: EffectState = { shake: 0, flash: 0, flashColor: "#ffffff" };
  private replay: ReplayState | null = null;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private lastNow: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.width = Math.max(1, cssWidth);
    this.height = Math.max(1, cssHeight);
    this.dpr = Math.min(2, Math.max(1, dpr));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  isReplaying(): boolean {
    return this.replay !== null;
  }

  render(frame: RenderFrame | null, events: GameEvent[], nowMs: number, options: RenderOptions): void {
    const dt = this.lastNow === null ? 0 : Math.min(0.1, Math.max(0, (nowMs - this.lastNow) / 1000));
    this.lastNow = nowMs;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBackdrop(ctx, this.width, this.height, nowMs / 1000);
    if (!frame) return;

    const flipped = options.mode !== GameMode.FreeForAll && options.selfTeam === 1;
    this.camera.fit(frame.arena, this.width, this.height, options.insets, flipped);
    for (const event of events) {
      if (event.kind === GameEventKind.Kickoff) {
        this.history.clear();
        this.replay = null;
      }
      if (event.kind === GameEventKind.Goal) this.replay = { goalTime: frame.time, startMs: nowMs + REPLAY_DELAY_MS };
      spawnEffect(event, this.particles, this.effects, frame);
    }
    this.history.push(frame);
    this.particles.update(dt);
    this.effects.shake *= Math.exp(-7 * dt);
    this.effects.flash *= Math.exp(-5 * dt);
    this.camera.shakeX = (Math.random() - 0.5) * this.effects.shake;
    this.camera.shakeY = (Math.random() - 0.5) * this.effects.shake;

    const view = this.resolveView(frame, nowMs);
    ctx.save();
    this.camera.apply(ctx);
    drawField(ctx, frame.arena, frame.closedGoals, nowMs / 1000);
    for (const p of view.players) {
      const color = TEAM_COLORS[p.team] ?? "#ffffff";
      drawTrail(ctx, this.history.trail(p.id, view.time, TRAIL_LIFETIME), color);
    }
    drawBall(ctx, view.ball, nowMs / 1000);
    for (const p of view.players) drawPlayer(ctx, p, nowMs / 1000);
    this.particles.draw(ctx);
    ctx.restore();
    drawLabels(ctx, view.players, this.camera);

    if (this.effects.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.55, this.effects.flash);
      ctx.fillStyle = this.effects.flashColor;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
    if (view.replay) drawReplayOverlay(ctx, this.width, this.height, nowMs / 1000);
  }

  private resolveView(frame: RenderFrame, nowMs: number) {
    const live = { time: frame.time, players: frame.players, ball: frame.ball, replay: false };
    const replay = this.replay;
    if (!replay) return live;
    if (frame.phase !== MatchPhase.GoalScored) {
      this.replay = null;
      return live;
    }
    if (nowMs < replay.startMs) return live;
    const time = replay.goalTime - REPLAY_LEAD_SECONDS + ((nowMs - replay.startMs) / 1000) * REPLAY_SPEED;
    if (time > replay.goalTime + REPLAY_TAIL_SECONDS) return live;
    const past = this.history.at(time);
    if (!past) return live;
    const byId = new Map(frame.players.map((p) => [p.id, p]));
    const players: RenderPlayer[] = past.players.flatMap((hp) => {
      const base = byId.get(hp.id);
      if (!base) return [];
      return [{ ...base, x: hp.x, y: hp.y, dashing: hp.dashing, eliminated: hp.eliminated, vx: 0, vy: 0, slowed: false }];
    });
    return { time, players, ball: { x: past.ballX, y: past.ballY, vx: 0, vy: 0 }, replay: true };
  }
}
