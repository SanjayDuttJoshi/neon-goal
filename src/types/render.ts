import type { ArenaDef, GameEventKind, MatchPhase } from "@/types/game";

export interface RenderPlayer {
  id: string;
  name: string;
  team: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dashing: boolean;
  slowed: boolean;
  eliminated: boolean;
  isSelf: boolean;
  isBot: boolean;
  /** 0 right after a dash, 1 when the dash is ready again. */
  dashReady: number;
}

export interface RenderBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface RenderFrame {
  /** Simulation time in seconds this frame represents. */
  time: number;
  phase: MatchPhase;
  phaseTimer: number;
  arena: ArenaDef;
  closedGoals: number[];
  ball: RenderBall;
  players: RenderPlayer[];
}

export interface HudState {
  phase: MatchPhase;
  phaseTimer: number;
  timeLeft: number;
  overtime: boolean;
  overtimeElapsed: number;
  scores: number[];
  lives: number[];
  selfTeam: number | null;
  selfDashReady: number;
}

export interface FeedItem {
  id: number;
  kind: GameEventKind;
  text: string;
  team: number;
  at: number;
}
