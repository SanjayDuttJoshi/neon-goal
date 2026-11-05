import { GameMode, type MatchPhase, type Vec2 } from "@/types/game";
import type { RenderFrame } from "@/types/render";
import type { Camera } from "@/render/camera";

/** Screen-space snapshot of the match, published only with ?debug=1 so automated playtests can "see" the game. */
export interface DebugProbe {
  phase: MatchPhase;
  self: Vec2 | null;
  ball: Vec2;
  ballVel: Vec2;
  ownGoal: Vec2 | null;
  enemyGoals: Vec2[];
  dashReady: number;
  /** Red touches left (0 = normal ball); the autopilot keeps its body off a red ball. */
  ballRed: number;
  selfOut: boolean;
  arenaEvent: string;
  frames: number;
  slowFrames: number;
  maxFrameMs: number;
}

declare global {
  interface Window {
    __neonProbe?: DebugProbe;
  }
}

const SLOW_FRAME_MS = 34;

const isDebug = (): boolean => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");

const DEBUG_ENABLED = isDebug();

let lastMs: number | null = null;

export const publishProbe = (frame: RenderFrame | null, camera: Camera, selfTeam: number | null, mode: GameMode, nowMs: number): void => {
  if (!DEBUG_ENABLED || !frame) return;
  const prev = window.__neonProbe;
  const frameMs = lastMs === null ? 0 : nowMs - lastMs;
  lastMs = nowMs;
  const self = frame.players.find((p) => p.isSelf) ?? null;
  const ball = camera.worldToScreen(frame.ball.x, frame.ball.y);
  const ahead = camera.worldToScreen(frame.ball.x + frame.ball.vx, frame.ball.y + frame.ball.vy);
  const team = self?.team ?? selfTeam;
  const own = frame.arena.goals.find((g) => g.team === team) ?? null;
  const enemies = frame.arena.goals.filter((g) => g.team !== team && !frame.closedGoals.includes(g.team));
  const targets = mode === GameMode.FreeForAll ? enemies : enemies.slice(0, 1);
  window.__neonProbe = {
    phase: frame.phase,
    self: self ? camera.worldToScreen(self.x, self.y) : null,
    ball,
    ballVel: { x: ahead.x - ball.x, y: ahead.y - ball.y },
    ownGoal: own ? camera.worldToScreen(own.centerX, own.centerY) : null,
    enemyGoals: targets.map((g) => camera.worldToScreen(g.centerX, g.centerY)),
    dashReady: self?.dashReady ?? 0,
    ballRed: frame.ball.redLeft,
    selfOut: (self?.outTime ?? 0) > 0,
    arenaEvent: frame.arenaEvent.kind ? `${frame.arenaEvent.kind}:${frame.arenaEvent.stage}` : "",
    frames: (prev?.frames ?? 0) + 1,
    slowFrames: (prev?.slowFrames ?? 0) + (frameMs > SLOW_FRAME_MS ? 1 : 0),
    maxFrameMs: Math.max(prev?.maxFrameMs ?? 0, frameMs),
  };
};
