import type { BotDifficulty, GameEvent, GameMode, MatchPhase, PlayerStats, RosterEntry } from "@/types/game";

export enum Channel {
  Hello = "hello",
  Lobby = "lobby",
  Snapshot = "snap",
  Input = "input",
  Command = "cmd",
  Kick = "kick",
}

export enum SessionStatus {
  Idle = "idle",
  Connecting = "connecting",
  Lobby = "lobby",
  InMatch = "match",
  Error = "error",
}

export enum LobbyStatus {
  Waiting = "waiting",
  Playing = "playing",
  Summary = "summary",
}

export enum SessionError {
  RoomNotFound = "room-not-found",
  VersionMismatch = "version-mismatch",
  Kicked = "kicked",
  ConnectionFailed = "connection-failed",
  HostLeft = "host-left",
  InvalidCode = "invalid-code",
}

export enum CommandKind {
  SwitchTeam = "switch-team",
  Spectate = "spectate",
}

export enum TransportKind {
  Online = "online",
  Local = "local",
  Offline = "offline",
}

export interface LobbyMember {
  peerId: string;
  clientId: string;
  name: string;
  /** Team index, or null for spectators. */
  team: number | null;
  connected: boolean;
}

export interface LobbySettings {
  mode: GameMode;
  durationSec: number;
  botFill: boolean;
  botDifficulty: BotDifficulty;
}

export interface SummaryPlayer {
  id: string;
  name: string;
  team: number;
  isBot: boolean;
  stats: PlayerStats;
}

export interface MatchSummary {
  winner: number;
  scores: number[];
  lives: number[];
  mode: GameMode;
  players: SummaryPlayer[];
}

export interface LobbyState {
  version: number;
  roomCode: string;
  hostPeerId: string;
  settings: LobbySettings;
  members: LobbyMember[];
  status: LobbyStatus;
  matchId: number;
  roster: RosterEntry[];
  summary: MatchSummary | null;
}

export interface HelloMessage {
  v: number;
  clientId: string;
  name: string;
}

export interface CommandMessage {
  kind: CommandKind;
  team: number;
}

export interface KickMessage {
  reason: string;
}

/** [seq, mx * 100, my * 100, dashCount] */
export type WireInput = [number, number, number, number];

/** [rosterIndex, x, y, vx, vy, flags, dashCooldown * 100, lastSeq] */
export type WirePlayer = [number, number, number, number, number, number, number, number];

/** [id, kind, x, y, team, playerIndex, otherIndexOrFlag, value] */
export type WireEvent = [number, string, number, number, number, number, number, number];

export interface WireSnapshot {
  k: number;
  m: number;
  ph: MatchPhase;
  pt: number;
  tl: number;
  ot: number;
  oe: number;
  sc: number[];
  lv: number[];
  cg: number[];
  b: [number, number, number, number];
  p: WirePlayer[];
  ev: WireEvent[];
  /** Per-player stats [goals, ownGoals, saves, bounces, powerShots], sent about once a second. */
  st?: number[][];
  w?: number;
}

export interface NetBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface NetPlayer {
  index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dashing: boolean;
  slowed: boolean;
  eliminated: boolean;
  botControlled: boolean;
  dashCooldown: number;
  lastSeq: number;
}

export interface NetSnapshot {
  tick: number;
  matchId: number;
  phase: MatchPhase;
  phaseTimer: number;
  timeLeft: number;
  overtime: boolean;
  overtimeElapsed: number;
  scores: number[];
  lives: number[];
  closedGoals: number[];
  ball: NetBall;
  players: NetPlayer[];
  events: GameEvent[];
  stats: PlayerStats[] | null;
  winner: number | null;
}
