export enum GameMode {
  Solo = "solo",
  Duo = "duo",
  Squad = "squad",
  FreeForAll = "ffa",
}

export enum MatchPhase {
  Countdown = "countdown",
  Playing = "playing",
  GoalScored = "goal",
  Ended = "ended",
}

export enum BotDifficulty {
  Easy = "easy",
  Normal = "normal",
  Hard = "hard",
}

export enum GameEventKind {
  TrailBounce = "trail",
  PowerBounce = "power",
  WallHit = "wall",
  BodyHit = "body",
  Goal = "goal",
  Save = "save",
  Kickoff = "kickoff",
  MatchEnd = "end",
  Eliminated = "elim",
  Slowed = "slow",
  Dash = "dash",
  Overtime = "ot",
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** A static wall. The normal points into the playable side. */
export interface WallDef extends Segment {
  nx: number;
  ny: number;
}

export interface GoalDef {
  team: number;
  mouth: WallDef;
  /** Unit normal pointing from the goal line into the field. */
  inwardX: number;
  inwardY: number;
  centerX: number;
  centerY: number;
  netWalls: WallDef[];
}

export interface ArenaDef {
  width: number;
  height: number;
  walls: WallDef[];
  goals: GoalDef[];
  spawns: Vec2[][];
  teamCount: number;
}

export interface PlayerInput {
  /** Movement intent, each axis in [-1, 1]. */
  mx: number;
  my: number;
  /** Monotonic counter, a dash is requested whenever it increases. */
  dash: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
  power: boolean;
}

export interface PlayerStats {
  goals: number;
  ownGoals: number;
  saves: number;
  bounces: number;
  powerShots: number;
}

export interface BotBrain {
  thinkTimer: number;
  targetX: number;
  targetY: number;
  wantDash: boolean;
  aimNoise: number;
}

export interface PlayerState {
  id: string;
  name: string;
  team: number;
  botControlled: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  faceX: number;
  faceY: number;
  dashTime: number;
  dashCooldown: number;
  dashX: number;
  dashY: number;
  lastDashCount: number;
  slowTime: number;
  slowImmunity: number;
  trail: TrailPoint[];
  eliminated: boolean;
  stats: PlayerStats;
  brain: BotBrain;
}

export interface TouchInfo {
  playerId: string;
  team: number;
  /** Simulation time of the touch, in seconds. */
  time: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lastTouch: TouchInfo | null;
  /** Latest touch by a different team than lastTouch (the shot a defender deflected). */
  prevTouch: TouchInfo | null;
}

export interface MatchConfig {
  mode: GameMode;
  durationSec: number;
  botDifficulty: BotDifficulty;
}

export interface RosterEntry {
  id: string;
  name: string;
  team: number;
  isBot: boolean;
}

export interface GameEvent {
  id: number;
  kind: GameEventKind;
  x: number;
  y: number;
  team: number;
  playerId: string;
  /** Secondary player, e.g. the conceding team on an own goal. */
  otherId: string;
  value: number;
}

export interface SimState {
  config: MatchConfig;
  arena: ArenaDef;
  tick: number;
  time: number;
  phase: MatchPhase;
  phaseTimer: number;
  timeLeft: number;
  overtime: boolean;
  overtimeElapsed: number;
  scores: number[];
  lives: number[];
  closedGoals: number[];
  players: PlayerState[];
  ball: BallState;
  events: GameEvent[];
  nextEventId: number;
  /** Winning team index, -1 for a draw, null while undecided. */
  winner: number | null;
  rngState: number;
  endAfterCelebration: boolean;
}
