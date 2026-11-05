import type { ArenaEventKind, ArenaEventStage, BotDifficulty, GameEvent, GameMode, MatchPhase, PlayerStats, RedBallMode, RosterEntry } from "@/types/game";

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
  redBall: RedBallMode;
  arenaEvents: boolean;
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

/** [rosterIndex, x, y, vx, vy, flags, dashCooldown * 100, lastSeq, outTime * 10] */
export type WirePlayer = [number, number, number, number, number, number, number, number, number];

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
  /** [x, y, vx, vy, heat percent towards red, redLeft] */
  b: [number, number, number, number, number, number];
  /** Arena event [kindIndex or -1, stageIndex, timer * 100] */
  ae: [number, number, number];
  p: WirePlayer[];
  ev: WireEvent[];
  /** Per-player stats [goals, ownGoals, saves, bounces, powerShots, knockouts], sent about once a second. */
  st?: number[][];
  w?: number;
}

export interface NetBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0..1 progress towards turning red. */
  heat: number;
  redLeft: number;
}

export interface NetArenaEvent {
  kind: ArenaEventKind | null;
  stage: ArenaEventStage;
  timer: number;
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
  shielded: boolean;
  outTime: number;
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
  arenaEvent: NetArenaEvent;
  players: NetPlayer[];
  events: GameEvent[];
  stats: PlayerStats[] | null;
  winner: number | null;
}
