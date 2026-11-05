import { MatchPhase, type GameEvent, type PlayerInput, type RosterEntry, type SimState } from "@/types/game";
import type { WireSnapshot } from "@/types/net";
import type { HudState, RenderFrame } from "@/types/render";
import { DASH_COOLDOWN, HEAT_TO_RED, SIM_DT, SNAPSHOT_EVERY_TICKS } from "@/game/constants";
import { drainEvents } from "@/game/events";
import { NEUTRAL_INPUT } from "@/game/players";
import { stepSim, type InputMap } from "@/game/simulation";
import { lerp } from "@/game/vector";
import { encodeSnapshot } from "@/net/protocol";

const SIM_DT_MS = SIM_DT * 1000;
const MAX_CATCHUP_STEPS = 8;
const MAX_FRAME_GAP_MS = 250;
const MAX_QUEUE = 6;
const TRIM_QUEUE_TO = 2;
const STATS_EVERY_SNAPSHOTS = 15;

interface QueuedInput {
  seq: number;
  input: PlayerInput;
}

interface InputQueue {
  queue: QueuedInput[];
  last: PlayerInput;
  lastSeq: number;
  lastQueuedSeq: number;
}

interface PrevPose {
  x: number;
  y: number;
}

/** Runs the authoritative match on the host and publishes snapshots. */
export class HostEngine {
  readonly state: SimState;
  readonly roster: RosterEntry[];
  readonly matchId: number;
  readonly localPlayerId: string | null;
  paused = false;
  onSnapshot: ((snapshot: WireSnapshot) => void) | null = null;
  private localInput: PlayerInput = { ...NEUTRAL_INPUT };
  private readonly queues = new Map<string, InputQueue>();
  private accumulatorMs = 0;
  private lastAdvanceMs: number | null = null;
  private prevPlayers = new Map<string, PrevPose>();
  private prevBall: PrevPose = { x: 0, y: 0 };
  private outbox: GameEvent[] = [];
  private effects: GameEvent[] = [];
  private snapshotCount = 0;

  constructor(state: SimState, roster: RosterEntry[], matchId: number, localPlayerId: string | null) {
    this.state = state;
    this.roster = roster;
    this.matchId = matchId;
    this.localPlayerId = localPlayerId;
    this.savePrev();
  }

  setLocalInput(input: PlayerInput): void {
    this.localInput = input;
  }

  receiveInput(playerId: string, seq: number, input: PlayerInput): void {
    if (!this.state.players.some((p) => p.id === playerId)) return;
    const queue = this.queueFor(playerId);
    if (seq <= queue.lastQueuedSeq) return;
    queue.lastQueuedSeq = seq;
    queue.queue.push({ seq, input });
    if (queue.queue.length > MAX_QUEUE) queue.queue.splice(0, queue.queue.length - TRIM_QUEUE_TO);
  }

  setBotControlled(playerId: string, botControlled: boolean): void {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;
    player.botControlled = botControlled;
    this.queues.delete(playerId);
  }

  /** Steps the simulation for the real time elapsed since the last call. */
  advance(nowMs: number): void {
    if (this.lastAdvanceMs === null) {
      this.lastAdvanceMs = nowMs;
      return;
    }
    const elapsed = Math.min(MAX_FRAME_GAP_MS, Math.max(0, nowMs - this.lastAdvanceMs));
    this.lastAdvanceMs = nowMs;
    if (this.paused) return;
    this.accumulatorMs += elapsed;
    let steps = 0;
    while (this.accumulatorMs >= SIM_DT_MS && steps < MAX_CATCHUP_STEPS) {
      this.step();
      this.accumulatorMs -= SIM_DT_MS;
      steps += 1;
    }
    if (steps === MAX_CATCHUP_STEPS) this.accumulatorMs = 0;
  }

  isEnded(): boolean {
    return this.state.phase === MatchPhase.Ended;
  }

  drainEffects(): GameEvent[] {
    const drained = this.effects;
    this.effects = [];
    return drained;
  }

  getRenderFrame(): RenderFrame {
    const { state } = this;
    const alpha = this.paused ? 1 : Math.min(1, this.accumulatorMs / SIM_DT_MS);
    const lookup = new Map(this.roster.map((r) => [r.id, r]));
    return {
      time: state.time + (alpha - 1) * SIM_DT,
      phase: state.phase,
      phaseTimer: state.phaseTimer,
      arena: state.arena,
      closedGoals: state.closedGoals,
      ball: {
        x: lerp(this.prevBall.x, state.ball.x, alpha),
        y: lerp(this.prevBall.y, state.ball.y, alpha),
        vx: state.ball.vx,
        vy: state.ball.vy,
        heat: state.ball.heat / HEAT_TO_RED[state.config.mode],
        redLeft: state.ball.redLeft,
      },
      arenaEvent: { ...state.arenaEvent },
      players: state.players.map((p) => {
        const prev = this.prevPlayers.get(p.id) ?? p;
        return {
          id: p.id,
          name: p.name,
          team: p.team,
          x: lerp(prev.x, p.x, alpha),
          y: lerp(prev.y, p.y, alpha),
          vx: p.vx,
          vy: p.vy,
          dashing: p.dashTime > 0,
          slowed: p.slowTime > 0,
          eliminated: p.eliminated,
          isSelf: p.id === this.localPlayerId,
          isBot: lookup.get(p.id)?.isBot ?? false,
          dashReady: 1 - p.dashCooldown / DASH_COOLDOWN,
          outTime: p.outTime,
          shielded: p.shieldTime > 0,
        };
      }),
    };
  }

  getHud(): HudState {
    const { state } = this;
    const self = state.players.find((p) => p.id === this.localPlayerId);
    return {
      phase: state.phase,
      phaseTimer: state.phaseTimer,
      timeLeft: state.timeLeft,
      overtime: state.overtime,
      overtimeElapsed: state.overtimeElapsed,
      scores: [...state.scores],
      lives: [...state.lives],
      selfTeam: self?.team ?? null,
      selfDashReady: self ? 1 - self.dashCooldown / DASH_COOLDOWN : 1,
      selfOutTime: self?.outTime ?? 0,
      redLeft: state.ball.redLeft,
      arenaEvent: { ...state.arenaEvent },
    };
  }

  private queueFor(playerId: string): InputQueue {
    let queue = this.queues.get(playerId);
    if (!queue) {
      queue = { queue: [], last: { ...NEUTRAL_INPUT }, lastSeq: 0, lastQueuedSeq: 0 };
      this.queues.set(playerId, queue);
    }
    return queue;
  }

  private savePrev(): void {
    this.prevBall = { x: this.state.ball.x, y: this.state.ball.y };
    this.prevPlayers = new Map(this.state.players.map((p) => [p.id, { x: p.x, y: p.y }]));
  }

  private step(): void {
    this.savePrev();
    const inputs: InputMap = {};
    if (this.localPlayerId) inputs[this.localPlayerId] = this.localInput;
    for (const [id, queue] of this.queues) {
      const next = queue.queue.shift();
      if (next) {
        queue.last = next.input;
        queue.lastSeq = next.seq;
      }
      inputs[id] = queue.last;
    }
    stepSim(this.state, inputs, SIM_DT);
    const events = drainEvents(this.state);
    this.outbox.push(...events);
    this.effects.push(...events);
    if (this.state.tick % SNAPSHOT_EVERY_TICKS === 0) this.publish();
  }

  private publish(): void {
    if (!this.onSnapshot) {
      this.outbox = [];
      return;
    }
    this.snapshotCount += 1;
    const lastSeqs = new Map([...this.queues].map(([id, q]) => [id, q.lastSeq]));
    const snapshot = encodeSnapshot(this.state, {
      matchId: this.matchId,
      lastSeqs,
      events: this.outbox,
      includeStats: this.snapshotCount % STATS_EVERY_SNAPSHOTS === 0 || this.isEnded(),
    });
    this.outbox = [];
    this.onSnapshot?.(snapshot);
  }
}
