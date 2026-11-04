import { GameEventKind, MatchPhase, type GameEvent, type PlayerStats, type RosterEntry, type SimState } from "@/types/game";
import type { NetPlayer, NetSnapshot, WireEvent, WireInput, WirePlayer, WireSnapshot } from "@/types/net";
import type { PlayerInput } from "@/types/game";
import { isFiniteNumber, isEnumValue, isNumberArray, isRecord } from "@/lib/guards";

export const PROTOCOL_VERSION = 1;
export const APP_ID = "neon-goal-arena-v1-sdj";

const FLAG_DASHING = 1;
const FLAG_SLOWED = 2;
const FLAG_ELIMINATED = 4;
const FLAG_BOT = 8;
const MAX_PLAYERS_ON_WIRE = 16;
const MAX_EVENTS_ON_WIRE = 64;

const PHASES = Object.values(MatchPhase);
const EVENT_KINDS = Object.values(GameEventKind);

const r1 = (value: number): number => Math.round(value * 10) / 10;
const r2 = (value: number): number => Math.round(value * 100);

export const encodeInput = (seq: number, input: PlayerInput): WireInput => [
  seq,
  Math.round(input.mx * 100),
  Math.round(input.my * 100),
  input.dash,
];

export const decodeInput = (data: unknown): { seq: number; input: PlayerInput } | null => {
  if (!isNumberArray(data, 4) || data.length !== 4) return null;
  const [seq, mx, my, dash] = data;
  return { seq, input: { mx: mx / 100, my: my / 100, dash } };
};

const statsRow = (stats: PlayerStats): number[] => [
  stats.goals,
  stats.ownGoals,
  stats.saves,
  stats.bounces,
  stats.powerShots,
];

export interface EncodeOptions {
  matchId: number;
  lastSeqs: Map<string, number>;
  events: GameEvent[];
  includeStats: boolean;
}

export const encodeSnapshot = (state: SimState, options: EncodeOptions): WireSnapshot => {
  const indexOf = new Map(state.players.map((p, i) => [p.id, i]));
  const players: WirePlayer[] = state.players.map((p, i) => [
    i,
    r1(p.x),
    r1(p.y),
    r1(p.vx),
    r1(p.vy),
    (p.dashTime > 0 ? FLAG_DASHING : 0) |
      (p.slowTime > 0 ? FLAG_SLOWED : 0) |
      (p.eliminated ? FLAG_ELIMINATED : 0) |
      (p.botControlled ? FLAG_BOT : 0),
    r2(p.dashCooldown),
    options.lastSeqs.get(p.id) ?? 0,
  ]);
  const events: WireEvent[] = options.events.map((e) => [
    e.id,
    e.kind,
    r1(e.x),
    r1(e.y),
    e.team,
    indexOf.get(e.playerId) ?? -1,
    e.otherId === "own" ? 1 : 0,
    Math.round(e.value),
  ]);
  const snapshot: WireSnapshot = {
    k: state.tick,
    m: options.matchId,
    ph: state.phase,
    pt: r2(state.phaseTimer),
    tl: r2(state.timeLeft),
    ot: state.overtime ? 1 : 0,
    oe: r2(state.overtimeElapsed),
    sc: [...state.scores],
    lv: [...state.lives],
    cg: [...state.closedGoals],
    b: [r1(state.ball.x), r1(state.ball.y), r1(state.ball.vx), r1(state.ball.vy)],
    p: players,
    ev: events,
  };
  if (options.includeStats) snapshot.st = state.players.map((p) => statsRow(p.stats));
  if (state.winner !== null) snapshot.w = state.winner;
  return snapshot;
};

const decodePlayer = (row: unknown): NetPlayer | null => {
  if (!isNumberArray(row, 8) || row.length !== 8) return null;
  const [index, x, y, vx, vy, flags, dashCd, lastSeq] = row;
  return {
    index,
    x,
    y,
    vx,
    vy,
    dashing: (flags & FLAG_DASHING) !== 0,
    slowed: (flags & FLAG_SLOWED) !== 0,
    eliminated: (flags & FLAG_ELIMINATED) !== 0,
    botControlled: (flags & FLAG_BOT) !== 0,
    dashCooldown: dashCd / 100,
    lastSeq,
  };
};

const decodeEvent = (row: unknown, roster: RosterEntry[]): GameEvent | null => {
  if (!Array.isArray(row) || row.length !== 8) return null;
  const [id, kind, x, y, team, playerIndex, own, value] = row as unknown[];
  if (!isEnumValue(EVENT_KINDS, kind)) return null;
  if (![id, x, y, team, playerIndex, own, value].every(isFiniteNumber)) return null;
  const index = playerIndex as number;
  return {
    id: id as number,
    kind,
    x: x as number,
    y: y as number,
    team: team as number,
    playerId: roster[index]?.id ?? "",
    otherId: own === 1 ? "own" : "",
    value: value as number,
  };
};

const decodeStats = (rows: unknown): PlayerStats[] | null => {
  if (!Array.isArray(rows) || rows.length > MAX_PLAYERS_ON_WIRE) return null;
  const result: PlayerStats[] = [];
  for (const row of rows) {
    if (!isNumberArray(row, 5) || row.length !== 5) return null;
    result.push({ goals: row[0], ownGoals: row[1], saves: row[2], bounces: row[3], powerShots: row[4] });
  }
  return result;
};

/** Validates and decodes a snapshot coming from an untrusted peer. */
export const decodeSnapshot = (data: unknown, roster: RosterEntry[]): NetSnapshot | null => {
  if (!isRecord(data)) return null;
  const { k, m, ph, pt, tl, ot, oe, sc, lv, cg, b, p, ev, st, w } = data;
  if (![k, m, pt, tl, ot, oe].every(isFiniteNumber) || !isEnumValue(PHASES, ph)) return null;
  if (!isNumberArray(sc, 8) || !isNumberArray(lv, 8) || !isNumberArray(cg, 8)) return null;
  if (!isNumberArray(b, 4) || b.length !== 4) return null;
  if (!Array.isArray(p) || p.length > MAX_PLAYERS_ON_WIRE) return null;
  if (!Array.isArray(ev) || ev.length > MAX_EVENTS_ON_WIRE) return null;
  const players: NetPlayer[] = [];
  for (const row of p) {
    const player = decodePlayer(row);
    if (!player || player.index < 0 || player.index >= roster.length) return null;
    players.push(player);
  }
  const events = ev.map((row) => decodeEvent(row, roster)).filter((e): e is GameEvent => e !== null);
  return {
    tick: k as number,
    matchId: m as number,
    phase: ph,
    phaseTimer: (pt as number) / 100,
    timeLeft: (tl as number) / 100,
    overtime: ot === 1,
    overtimeElapsed: (oe as number) / 100,
    scores: sc,
    lives: lv,
    closedGoals: cg,
    ball: { x: b[0], y: b[1], vx: b[2], vy: b[3] },
    players,
    events,
    stats: st === undefined ? null : decodeStats(st),
    winner: isFiniteNumber(w) ? w : null,
  };
};
