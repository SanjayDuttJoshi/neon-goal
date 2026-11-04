import type { ArenaDef, PlayerInput, PlayerState, RosterEntry } from "@/types/game";
import type { NetPlayer } from "@/types/net";
import { DASH_DURATION, SIM_DT, SLOW_DURATION } from "@/game/constants";
import {
  collidePlayerWithWalls,
  createPlayer,
  normalizeInput,
  steerPlayer,
  tickPlayerTimers,
  tryStartDash,
} from "@/game/players";

export interface PendingInput {
  seq: number;
  input: PlayerInput;
}

const MAX_PENDING = 120;
const MAX_ERROR = 90;

/**
 * Client-side prediction for the local player: inputs are applied right away
 * and corrected whenever an authoritative snapshot arrives.
 */
export class LocalPredictor {
  private readonly arena: ArenaDef;
  private readonly player: PlayerState;
  private pending: PendingInput[] = [];
  private active = false;
  errorX = 0;
  errorY = 0;

  constructor(arena: ArenaDef, entry: RosterEntry) {
    this.arena = arena;
    this.player = createPlayer(entry, { x: 0, y: 0 });
  }

  get x(): number {
    return this.player.x;
  }

  get y(): number {
    return this.player.y;
  }

  get vx(): number {
    return this.player.vx;
  }

  get vy(): number {
    return this.player.vy;
  }

  get dashing(): boolean {
    return this.player.dashTime > 0;
  }

  isActive(): boolean {
    return this.active;
  }

  /** Records an input; when prediction is live the local copy moves immediately. */
  push(seq: number, input: PlayerInput): void {
    this.pending.push({ seq, input });
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    if (this.active) this.simulate(input);
  }

  deactivate(lastDashCount: number): void {
    this.active = false;
    this.pending = [];
    this.player.lastDashCount = lastDashCount;
    this.errorX = 0;
    this.errorY = 0;
  }

  reconcile(net: NetPlayer): void {
    const hadState = this.active;
    const beforeX = this.player.x + this.errorX;
    const beforeY = this.player.y + this.errorY;
    this.pending = this.pending.filter((p) => p.seq > net.lastSeq);
    const p = this.player;
    p.x = net.x;
    p.y = net.y;
    p.vx = net.vx;
    p.vy = net.vy;
    p.dashCooldown = net.dashCooldown;
    p.dashTime = net.dashing ? Math.max(p.dashTime, DASH_DURATION / 2) : 0;
    p.slowTime = net.slowed ? Math.max(p.slowTime, SLOW_DURATION / 2) : 0;
    p.eliminated = net.eliminated;
    this.active = !net.eliminated;
    for (const pending of this.pending) this.simulate(pending.input);
    if (!hadState) return;
    this.errorX = beforeX - p.x;
    this.errorY = beforeY - p.y;
    if (Math.hypot(this.errorX, this.errorY) > MAX_ERROR) {
      this.errorX = 0;
      this.errorY = 0;
    }
  }

  /** Smoothly bleeds off correction error so the player never visibly snaps. */
  decayError(dtSeconds: number): void {
    const k = Math.exp(-12 * dtSeconds);
    this.errorX *= k;
    this.errorY *= k;
  }

  private simulate(input: PlayerInput): void {
    const p = this.player;
    tickPlayerTimers(p, SIM_DT);
    const move = normalizeInput(input);
    tryStartDash(p, input, move);
    steerPlayer(p, move, SIM_DT, 1);
    p.x += p.vx * SIM_DT;
    p.y += p.vy * SIM_DT;
    collidePlayerWithWalls(p, this.arena);
  }
}
