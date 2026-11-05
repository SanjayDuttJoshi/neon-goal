import type { ArenaDef, ArenaEventKind, ArenaEventStage, GameEventKind, MatchPhase } from "@/types/game";

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
  /** Seconds left sitting out after a red-ball burn, 0 when on the field. */
  outTime: number;
  shielded: boolean;
}

export interface RenderBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0..1 progress towards turning red. */
  heat: number;
  /** Red touches left; 0 when the ball is normal. */
  redLeft: number;
}

export interface RenderArenaEvent {
  kind: ArenaEventKind | null;
  stage: ArenaEventStage;
  timer: number;
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
  arenaEvent: RenderArenaEvent;
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
  selfOutTime: number;
  redLeft: number;
  arenaEvent: RenderArenaEvent;
}

export interface FeedItem {
  id: number;
  kind: GameEventKind;
  text: string;
  team: number;
  at: number;
}
