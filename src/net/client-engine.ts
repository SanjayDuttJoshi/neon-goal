import { ArenaEventKind, ArenaEventStage, MatchPhase, type ArenaDef, type GameEvent, type PlayerInput, type PlayerStats, type RosterEntry } from "@/types/game";
import type { NetArenaEvent, NetPlayer, NetSnapshot, WireInput } from "@/types/net";
import type { HudState, RenderFrame, RenderPlayer } from "@/types/render";
import { DASH_COOLDOWN, ICE_TRACTION, SIM_DT, SIM_HZ } from "@/game/constants";
import { lerp } from "@/game/vector";
import { encodeInput } from "@/net/protocol";
import { LocalPredictor } from "@/net/prediction";

const TICKS_PER_MS = SIM_HZ / 1000;
const INTERP_DELAY_TICKS = 6;
const MAX_BUFFER = 90;
const MAX_EXTRAPOLATE_TICKS = 4;
const CLOCK_RESET_TICKS = 40;
const TELEPORT_DISTANCE = 150;

const isIceActive = (ev: NetArenaEvent): boolean => ev.kind === ArenaEventKind.Ice && ev.stage === ArenaEventStage.Active;

interface QueuedEffect {
  tick: number;
  event: GameEvent;
}

/** Turns a stream of host snapshots into smooth frames on a guest. */
export class ClientEngine {
  readonly matchId: number;
  readonly roster: RosterEntry[];
  readonly arena: ArenaDef;
  readonly selfIndex: number;
  latestStats: PlayerStats[] | null = null;
  lastArrivalMs = 0;
  private buffer: NetSnapshot[] = [];
  private clockOffset: number | null = null;
  private lastEventId = 0;
  private effects: QueuedEffect[] = [];
  private seq = 0;
  private lastDash = 0;
  private lastRenderMs: number | null = null;
  private readonly predictor: LocalPredictor | null;

  constructor(matchId: number, roster: RosterEntry[], arena: ArenaDef, selfId: string | null) {
    this.matchId = matchId;
    this.roster = roster;
    this.arena = arena;
    this.selfIndex = selfId ? roster.findIndex((r) => r.id === selfId) : -1;
    this.predictor = this.selfIndex >= 0 ? new LocalPredictor(arena, roster[this.selfIndex]) : null;
  }

  latest(): NetSnapshot | null {
    return this.buffer[this.buffer.length - 1] ?? null;
  }

  receive(snap: NetSnapshot, nowMs: number): void {
    if (snap.matchId !== this.matchId) return;
    const last = this.latest();
    if (last && snap.tick <= last.tick) return;
    this.buffer.push(snap);
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
    this.lastArrivalMs = nowMs;
    this.updateClock(snap.tick - nowMs * TICKS_PER_MS);
    for (const event of snap.events) {
      if (event.id <= this.lastEventId) continue;
      this.lastEventId = event.id;
      this.effects.push({ tick: snap.tick, event });
    }
    if (snap.stats) this.latestStats = snap.stats;
    this.reconcile(snap);
  }

  /** Called at the simulation rate; returns the input packet to send to the host. */
  sampleInput(input: PlayerInput): WireInput | null {
    if (this.selfIndex < 0) return null;
    this.seq += 1;
    this.lastDash = input.dash;
    this.predictor?.push(this.seq, input);
    return encodeInput(this.seq, input);
  }

  drainEffects(nowMs: number): GameEvent[] {
    const renderTick = this.renderTick(nowMs);
    const ready = this.effects.filter((e) => e.tick <= renderTick + 1);
    this.effects = this.effects.filter((e) => e.tick > renderTick + 1);
    return ready.map((e) => e.event);
  }

  getRenderFrame(nowMs: number): RenderFrame | null {
    if (this.buffer.length === 0) return null;
    const dt = this.lastRenderMs === null ? 0 : (nowMs - this.lastRenderMs) / 1000;
    this.lastRenderMs = nowMs;
    this.predictor?.decayError(Math.max(0, dt));
    const rt = this.renderTick(nowMs);
    const [a, b, t] = this.bracket(rt);
    const players = a.players.map((pa) => this.renderPlayer(pa, b.players[pa.index] ?? pa, t, b.tick - a.tick));
    const base = t < 0.5 ? a : b;
    const ball = { ...this.blend(a.ball, b.ball, t, b.tick - a.tick), heat: base.ball.heat, redLeft: base.ball.redLeft };
    return {
      time: rt * SIM_DT,
      phase: base.phase,
      phaseTimer: base.phaseTimer,
      arena: this.arena,
      closedGoals: base.closedGoals,
      ball,
      players,
      arenaEvent: base.arenaEvent,
    };
  }

  getHud(): HudState | null {
    const snap = this.latest();
    if (!snap) return null;
    const self = this.selfIndex >= 0 ? snap.players[this.selfIndex] : undefined;
    return {
      phase: snap.phase,
      phaseTimer: snap.phaseTimer,
      timeLeft: snap.timeLeft,
      overtime: snap.overtime,
      overtimeElapsed: snap.overtimeElapsed,
      scores: snap.scores,
      lives: snap.lives,
      selfTeam: self ? this.roster[this.selfIndex].team : null,
      selfDashReady: self ? 1 - self.dashCooldown / DASH_COOLDOWN : 1,
      selfOutTime: self?.outTime ?? 0,
      redLeft: snap.ball.redLeft,
      arenaEvent: snap.arenaEvent,
    };
  }

  private updateClock(sample: number): void {
    if (this.clockOffset === null || Math.abs(sample - this.clockOffset) > CLOCK_RESET_TICKS) {
      this.clockOffset = sample;
      return;
    }
    const rate = sample > this.clockOffset ? 0.3 : 0.02;
    this.clockOffset += (sample - this.clockOffset) * rate;
  }

  private renderTick(nowMs: number): number {
    return nowMs * TICKS_PER_MS + (this.clockOffset ?? 0) - INTERP_DELAY_TICKS;
  }

  private bracket(rt: number): [NetSnapshot, NetSnapshot, number] {
    const first = this.buffer[0];
    const last = this.buffer[this.buffer.length - 1];
    if (rt <= first.tick) return [first, first, 0];
    if (rt >= last.tick) {
      const ahead = Math.min(rt - last.tick, MAX_EXTRAPOLATE_TICKS);
      return [last, last, ahead];
    }
    for (let i = this.buffer.length - 1; i > 0; i -= 1) {
      const a = this.buffer[i - 1];
      const b = this.buffer[i];
      if (a.tick <= rt && rt <= b.tick) return [a, b, (rt - a.tick) / Math.max(1, b.tick - a.tick)];
    }
    return [last, last, 0];
  }

  /** Interpolates between two states, or extrapolates when both are the same snapshot. */
  private blend<T extends { x: number; y: number; vx: number; vy: number }>(a: T, b: T, t: number, span: number) {
    if (span === 0) {
      const ahead = t * SIM_DT;
      return { x: a.x + a.vx * ahead, y: a.y + a.vy * ahead, vx: a.vx, vy: a.vy };
    }
    if (Math.hypot(b.x - a.x, b.y - a.y) > TELEPORT_DISTANCE) return t < 0.5 ? { ...a } : { ...b };
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), vx: lerp(a.vx, b.vx, t), vy: lerp(a.vy, b.vy, t) };
  }

  private renderPlayer(a: NetPlayer, b: NetPlayer, t: number, span: number): RenderPlayer {
    const entry = this.roster[a.index];
    const isSelf = a.index === this.selfIndex;
    const pose = this.blend(a, b, t, span);
    const predictor = this.predictor;
    const usePrediction = isSelf && predictor !== null && predictor.isActive();
    return {
      id: entry.id,
      name: entry.name,
      team: entry.team,
      x: usePrediction ? predictor.x + predictor.errorX : pose.x,
      y: usePrediction ? predictor.y + predictor.errorY : pose.y,
      vx: usePrediction ? predictor.vx : pose.vx,
      vy: usePrediction ? predictor.vy : pose.vy,
      dashing: usePrediction ? predictor.dashing : b.dashing,
      slowed: b.slowed,
      eliminated: b.eliminated,
      isSelf,
      isBot: entry.isBot,
      dashReady: 1 - b.dashCooldown / DASH_COOLDOWN,
      outTime: b.outTime,
      shielded: b.shielded,
    };
  }

  private reconcile(snap: NetSnapshot): void {
    if (!this.predictor) return;
    const own = snap.players[this.selfIndex];
    const live = snap.phase === MatchPhase.Playing || snap.phase === MatchPhase.GoalScored;
    if (!own || !live || own.eliminated || own.outTime > 0) {
      this.predictor.deactivate(this.lastDash);
      return;
    }
    this.predictor.traction = isIceActive(snap.arenaEvent) ? ICE_TRACTION : 1;
    this.predictor.reconcile(own);
  }
}
