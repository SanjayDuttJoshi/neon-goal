import type { GameEvent, PlayerInput } from "@/types/game";
import {
  Channel,
  CommandKind,
  LobbyStatus,
  SessionError,
  SessionStatus,
  TransportKind,
  type LobbySettings,
  type LobbyState,
  type NetSnapshot,
} from "@/types/net";
import type { RenderFrame } from "@/types/render";
import type { UiState } from "@/types/session";
import { buildArena } from "@/game/arena";
import { MODE_INFO, SIM_DT } from "@/game/constants";
import { createMatch } from "@/game/match";
import { NEUTRAL_INPUT } from "@/game/players";
import { isRecord } from "@/lib/guards";
import { createTicker, type Ticker } from "@/lib/ticker";
import { ClientEngine } from "@/net/client-engine";
import { appendFeed, describeEvent, isRepeat } from "@/net/feed";
import { HostEngine } from "@/net/host-engine";
import {
  addMember,
  applySettings,
  buildRoster,
  buildSummary,
  canStart,
  createLobby,
  markDisconnected,
  matchConfigFor,
  moveMember,
  removeMember,
  sanitizeName,
  type StartCheck,
} from "@/net/lobby";
import { parseCommand, parseHello, parseLobby } from "@/net/lobby-codec";
import { decodeInput, decodeSnapshot, PROTOCOL_VERSION } from "@/net/protocol";
import { resumeFromSnapshot } from "@/net/resume";
import { generateRoomCode, isValidRoomCode } from "@/net/room-code";
import { createOfflineTransport, type Transport } from "@/net/transport";
import { INITIAL_UI_STATE, UiStore } from "@/net/ui-store";

const JOIN_TIMEOUT_MS = 15000;
const HOST_SWITCH_TIMEOUT_MS = 8000;
const PING_INTERVAL_MS = 2000;
const WEAK_CONNECTION_MS = 1500;
const LOST_CONNECTION_MS = 9000;
const HUD_INTERVAL_MS = 100;
const SUMMARY_DELAY_MS = 2600;
const TICK_INTERVAL_MS = 8;
const SIM_DT_MS = SIM_DT * 1000;

export type TransportFactory = (kind: TransportKind, roomCode: string) => Promise<Transport>;

export interface FrameOutput {
  frame: RenderFrame | null;
  effects: GameEvent[];
}

export class RoomSession {
  private readonly store = new UiStore(INITIAL_UI_STATE);
  private readonly ticker: Ticker;
  private transport: Transport | null = null;
  private lobby: LobbyState | null = null;
  private host: HostEngine | null = null;
  private client: ClientEngine | null = null;
  private lastSnapshot: NetSnapshot | null = null;
  private localInput: PlayerInput = { ...NEUTRAL_INPUT };
  private inputAccumulatorMs = 0;
  private lastTickMs: number | null = null;
  private lastHudMs = 0;
  private readonly kicked = new Set<string>();
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private summaryPending = false;
  private migrating = false;
  private feedId = 0;
  private name = "Player";

  constructor(
    private readonly clientId: string,
    private readonly makeTransport: TransportFactory,
  ) {
    this.ticker = createTicker(() => this.onTick());
    this.store.set({ selfClientId: clientId });
  }

  subscribe = (listener: () => void): (() => void) => this.store.subscribe(listener);
  getUi = (): UiState => this.store.get();

  async hostRoom(name: string, kind: TransportKind, settings: LobbySettings): Promise<void> {
    this.name = sanitizeName(name);
    const code = generateRoomCode();
    this.store.set({ status: SessionStatus.Connecting, transportKind: kind, error: null });
    if (!(await this.connect(kind, code))) return;
    const self = this.selfMember();
    this.lobby = createLobby(code, self, settings);
    this.store.set({ status: SessionStatus.Lobby, isHost: true });
    this.publishLobby();
    this.startLoops();
  }

  async joinRoom(name: string, kind: TransportKind, code: string): Promise<void> {
    this.name = sanitizeName(name);
    if (!isValidRoomCode(code)) {
      this.fail(SessionError.InvalidCode);
      return;
    }
    this.store.set({ status: SessionStatus.Connecting, transportKind: kind, error: null });
    if (!(await this.connect(kind, code))) return;
    this.sendHello();
    this.later(JOIN_TIMEOUT_MS, () => {
      if (!this.selfInLobby()) this.fail(SessionError.RoomNotFound);
    });
    this.startLoops();
  }

  startPractice(name: string, settings: LobbySettings): void {
    this.name = sanitizeName(name);
    this.transport = createOfflineTransport();
    this.lobby = createLobby("PRACTICE", this.selfMember(), { ...settings, botFill: true });
    this.store.set({ isPractice: true, isHost: true, transportKind: TransportKind.Offline, selfPeerId: this.transport.selfId });
    this.startLoops();
    this.startMatch();
  }

  leave(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ticker.dispose();
    this.transport?.leave();
    this.transport = null;
    this.host = null;
    this.client = null;
    this.lobby = null;
  }

  setInput(input: PlayerInput): void {
    this.localInput = input;
  }

  // ---------- host actions ----------

  updateSettings(patch: Partial<LobbySettings>): void {
    if (!this.isHost() || !this.lobby || this.lobby.status === LobbyStatus.Playing) return;
    this.lobby = applySettings(this.lobby, { ...this.lobby.settings, ...patch });
    this.publishLobby();
  }

  moveToTeam(peerId: string, team: number | null): void {
    if (!this.isHost() || !this.lobby || this.lobby.status === LobbyStatus.Playing) return;
    this.lobby = moveMember(this.lobby, peerId, team);
    this.publishLobby();
  }

  kick(peerId: string): void {
    const member = this.lobby?.members.find((m) => m.peerId === peerId);
    if (!this.isHost() || !this.lobby || !member || peerId === this.transport?.selfId) return;
    this.kicked.add(member.clientId);
    this.transport?.send(Channel.Kick, { reason: "kicked" }, peerId);
    this.lobby = removeMember(this.lobby, peerId);
    this.host?.setBotControlled(member.clientId, true);
    this.publishLobby();
  }

  startCheck(): StartCheck {
    return this.lobby ? canStart(this.lobby) : { ok: false, reason: "" };
  }

  startMatch(): void {
    if (!this.isHost() || !this.lobby || !canStart(this.lobby).ok) return;
    const roster = buildRoster(this.lobby);
    const matchId = this.lobby.matchId + 1;
    const state = createMatch(matchConfigFor(this.lobby.settings), roster, Math.floor(Math.random() * 2 ** 31));
    const localId = roster.some((r) => r.id === this.clientId) ? this.clientId : null;
    this.host = new HostEngine(state, roster, matchId, localId);
    if (!this.store.get().isPractice) this.host.onSnapshot = (snapshot) => this.transport?.send(Channel.Snapshot, snapshot);
    this.client = null;
    this.summaryPending = false;
    this.lobby = { ...this.lobby, status: LobbyStatus.Playing, matchId, roster, summary: null };
    this.store.set({ feed: [], paused: false });
    this.publishLobby();
  }

  backToLobby(): void {
    if (!this.isHost() || !this.lobby) return;
    if (this.store.get().isPractice) {
      this.startMatch();
      return;
    }
    const members = this.lobby.members.filter((m) => m.connected);
    this.lobby = { ...this.lobby, members, status: LobbyStatus.Waiting, roster: [], summary: null };
    this.host = null;
    this.publishLobby();
  }

  togglePause(): void {
    if (!this.host || !this.store.get().isPractice) return;
    this.host.paused = !this.host.paused;
    this.store.set({ paused: this.host.paused });
  }

  setPaused(paused: boolean): void {
    if (!this.host || !this.store.get().isPractice) return;
    this.host.paused = paused;
    this.store.set({ paused });
  }

  // ---------- any member ----------

  requestTeam(team: number | null): void {
    const selfId = this.transport?.selfId ?? "";
    if (this.isHost()) {
      this.moveToTeam(selfId, team);
      return;
    }
    const kind = team === null ? CommandKind.Spectate : CommandKind.SwitchTeam;
    this.sendToHost(Channel.Command, { kind, team: team ?? -1 });
  }

  /** Called every animation frame by the renderer. */
  frame(nowMs: number): FrameOutput {
    let frame: RenderFrame | null = null;
    let effects: GameEvent[] = [];
    if (this.host) {
      frame = this.host.getRenderFrame();
      effects = this.host.drainEffects();
    } else if (this.client) {
      frame = this.client.getRenderFrame(nowMs);
      effects = this.client.drainEffects(nowMs);
    }
    if (effects.length > 0) this.pushFeed(effects, nowMs);
    return { frame, effects };
  }

  // ---------- internals ----------

  private async connect(kind: TransportKind, code: string): Promise<boolean> {
    try {
      this.transport = await this.makeTransport(kind, code);
    } catch {
      this.fail(SessionError.ConnectionFailed);
      return false;
    }
    const t = this.transport;
    this.store.set({ selfPeerId: t.selfId });
    t.onPeerJoin((peerId) => this.onPeerJoin(peerId));
    t.onPeerLeave((peerId) => this.onPeerLeave(peerId));
    t.on(Channel.Hello, (data, peerId) => this.onHello(data, peerId));
    t.on(Channel.Lobby, (data, peerId) => this.onLobby(data, peerId));
    t.on(Channel.Snapshot, (data, peerId) => this.onSnapshot(data, peerId));
    t.on(Channel.Input, (data, peerId) => this.onInput(data, peerId));
    t.on(Channel.Command, (data, peerId) => this.onCommand(data, peerId));
    t.on(Channel.Kick, (data, peerId) => this.onKick(data, peerId));
    return true;
  }

  private startLoops(): void {
    this.ticker.start(TICK_INTERVAL_MS);
    this.pingTimer = setInterval(() => this.measurePing(), PING_INTERVAL_MS);
  }

  private selfMember() {
    return { peerId: this.transport?.selfId ?? "", clientId: this.clientId, name: this.name, team: 0, connected: true };
  }

  private isHost(): boolean {
    return !!this.lobby && !!this.transport && this.lobby.hostPeerId === this.transport.selfId;
  }

  private selfInLobby(): boolean {
    return !!this.lobby?.members.some((m) => m.clientId === this.clientId);
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private fail(error: SessionError): void {
    this.leave();
    this.store.set({ status: SessionStatus.Error, error, lobby: null, hud: null });
  }

  private sendHello(target?: string): void {
    this.transport?.send(Channel.Hello, { v: PROTOCOL_VERSION, clientId: this.clientId, name: this.name }, target);
  }

  private sendToHost(channel: Channel, data: unknown): void {
    if (this.lobby) this.transport?.send(channel, data, this.lobby.hostPeerId);
  }

  private publishLobby(): void {
    if (!this.lobby) return;
    this.transport?.send(Channel.Lobby, this.lobby);
    this.syncUi();
  }

  private syncUi(): void {
    const lobby = this.lobby;
    const inMatch = lobby?.status === LobbyStatus.Playing || lobby?.status === LobbyStatus.Summary;
    this.store.set({
      lobby,
      isHost: this.isHost(),
      status: !lobby ? this.store.get().status : inMatch ? SessionStatus.InMatch : SessionStatus.Lobby,
    });
  }

  private onPeerJoin(peerId: string): void {
    if (!this.selfInLobby()) this.sendHello(peerId);
  }

  private onPeerLeave(peerId: string): void {
    if (!this.lobby) return;
    if (this.isHost()) {
      const member = this.lobby.members.find((m) => m.peerId === peerId);
      if (!member) return;
      this.lobby = markDisconnected(this.lobby, peerId);
      this.host?.setBotControlled(member.clientId, true);
      this.notice(`${member.name} chala gaya`);
      this.publishLobby();
      return;
    }
    if (peerId === this.lobby.hostPeerId) this.handleHostLost();
  }

  private onHello(data: unknown, peerId: string): void {
    const hello = parseHello(data);
    if (!hello || !this.isHost() || !this.lobby || this.store.get().isPractice) return;
    if (hello.v !== PROTOCOL_VERSION || this.kicked.has(hello.clientId)) {
      this.transport?.send(Channel.Kick, { reason: hello.v !== PROTOCOL_VERSION ? "version" : "kicked" }, peerId);
      return;
    }
    const known = this.lobby.members.some((m) => m.clientId === hello.clientId);
    this.lobby = addMember(this.lobby, peerId, hello.clientId, hello.name);
    if (this.lobby.roster.some((r) => r.id === hello.clientId)) this.host?.setBotControlled(hello.clientId, false);
    if (!known) this.notice(`${sanitizeName(hello.name)} aa gaya`);
    this.publishLobby();
  }

  private onLobby(data: unknown, peerId: string): void {
    if (this.isHost()) return;
    const next = parseLobby(data);
    if (!next || next.hostPeerId !== peerId) return;
    if (next.version !== PROTOCOL_VERSION) {
      this.fail(SessionError.VersionMismatch);
      return;
    }
    this.migrating = false;
    const needsClient = next.status === LobbyStatus.Playing && this.client?.matchId !== next.matchId;
    if (needsClient) {
      const info = MODE_INFO[next.settings.mode];
      this.client = new ClientEngine(next.matchId, next.roster, buildArena(next.settings.mode, info.teamSize), this.clientId);
      this.lastSnapshot = null;
      this.store.set({ feed: [] });
    }
    if (next.status === LobbyStatus.Waiting) this.client = null;
    this.lobby = next;
    if (this.selfInLobby()) this.syncUi();
  }

  private onSnapshot(data: unknown, peerId: string): void {
    if (!this.client || !this.lobby || peerId !== this.lobby.hostPeerId) return;
    const snap = decodeSnapshot(data, this.lobby.roster);
    if (!snap) return;
    this.client.receive(snap, performance.now());
    this.lastSnapshot = this.client.latest();
  }

  private onInput(data: unknown, peerId: string): void {
    if (!this.host || !this.lobby) return;
    const member = this.lobby.members.find((m) => m.peerId === peerId);
    const decoded = decodeInput(data);
    if (member && decoded) this.host.receiveInput(member.clientId, decoded.seq, decoded.input);
  }

  private onCommand(data: unknown, peerId: string): void {
    const command = parseCommand(data);
    if (!command || !this.isHost()) return;
    this.moveToTeam(peerId, command.kind === CommandKind.Spectate ? null : command.team);
  }

  private onKick(data: unknown, peerId: string): void {
    if (this.lobby && peerId !== this.lobby.hostPeerId) return;
    const isVersion = isRecord(data) && data.reason === "version";
    this.fail(isVersion ? SessionError.VersionMismatch : SessionError.Kicked);
  }

  private handleHostLost(): void {
    if (this.migrating || !this.lobby || !this.transport) return;
    this.migrating = true;
    const oldHost = this.lobby.hostPeerId;
    const selfId = this.transport.selfId;
    const connected = new Set([...this.transport.peers(), selfId]);
    const candidates = this.lobby.members
      .filter((m) => m.connected && m.peerId !== oldHost && connected.has(m.peerId))
      .map((m) => m.peerId)
      .sort();
    if (candidates[0] === selfId) {
      this.becomeHost(oldHost);
      return;
    }
    this.notice("Host chala gaya… naya host dhoond rahe hain");
    this.later(HOST_SWITCH_TIMEOUT_MS, () => {
      if (this.migrating && this.lobby?.hostPeerId === oldHost) this.fail(SessionError.HostLeft);
    });
  }

  private becomeHost(oldHost: string): void {
    if (!this.lobby) return;
    const oldMember = this.lobby.members.find((m) => m.peerId === oldHost);
    let lobby: LobbyState = { ...this.lobby, hostPeerId: this.transport?.selfId ?? "" };
    lobby = markDisconnected(lobby, oldHost);
    this.lobby = lobby;
    this.migrating = false;
    if (lobby.status !== LobbyStatus.Waiting && this.lastSnapshot) {
      const state = resumeFromSnapshot(
        matchConfigFor(lobby.settings),
        lobby.roster,
        this.lastSnapshot,
        this.client?.latestStats ?? null,
        Math.floor(Math.random() * 2 ** 31),
      );
      const localId = lobby.roster.some((r) => r.id === this.clientId) ? this.clientId : null;
      this.host = new HostEngine(state, lobby.roster, lobby.matchId, localId);
      this.host.onSnapshot = (snapshot) => this.transport?.send(Channel.Snapshot, snapshot);
      const offline = lobby.members.filter((m) => !m.connected).map((m) => m.clientId);
      lobby.roster.filter((r) => offline.includes(r.id) || r.id === oldMember?.clientId).forEach((r) => this.host?.setBotControlled(r.id, true));
      this.summaryPending = lobby.status === LobbyStatus.Summary;
    }
    this.client = null;
    this.notice("Host chala gaya, ab tum host ho 👑");
    this.publishLobby();
  }

  private onTick(): void {
    const now = performance.now();
    const elapsed = this.lastTickMs === null ? 0 : Math.min(250, now - this.lastTickMs);
    this.lastTickMs = now;
    if (this.host) {
      this.host.setLocalInput(this.localInput);
      this.host.advance(now);
      if (this.host.isEnded() && this.lobby?.status === LobbyStatus.Playing && !this.summaryPending) {
        this.summaryPending = true;
        this.later(SUMMARY_DELAY_MS, () => this.showSummary());
      }
    } else if (this.client) {
      this.tickClient(now, elapsed);
    }
    if (now - this.lastHudMs >= HUD_INTERVAL_MS) {
      this.lastHudMs = now;
      const hud = this.host?.getHud() ?? this.client?.getHud() ?? null;
      this.store.set({ hud });
    }
  }

  private tickClient(now: number, elapsed: number): void {
    const client = this.client;
    if (!client) return;
    this.inputAccumulatorMs = Math.min(this.inputAccumulatorMs + elapsed, SIM_DT_MS * 4);
    while (this.inputAccumulatorMs >= SIM_DT_MS) {
      this.inputAccumulatorMs -= SIM_DT_MS;
      const wire = client.sampleInput(this.localInput);
      if (wire) this.sendToHost(Channel.Input, wire);
    }
    if (client.lastArrivalMs === 0 || this.lobby?.status !== LobbyStatus.Playing) return;
    const silence = now - client.lastArrivalMs;
    const weak = silence > WEAK_CONNECTION_MS;
    if (weak !== this.store.get().weakConnection) this.store.set({ weakConnection: weak });
    if (silence > LOST_CONNECTION_MS) this.handleHostLost();
  }

  private showSummary(): void {
    if (!this.host || !this.lobby || !this.isHost()) return;
    const summary = buildSummary(this.host.state, this.lobby.roster);
    this.lobby = { ...this.lobby, status: LobbyStatus.Summary, summary };
    this.publishLobby();
  }

  private async measurePing(): Promise<void> {
    if (!this.transport || !this.lobby || this.isHost()) return;
    try {
      const ping = await this.transport.ping(this.lobby.hostPeerId);
      this.store.set({ ping: Math.round(ping) });
    } catch {
      this.store.set({ ping: null });
    }
  }

  private notice(text: string): void {
    this.store.set({ notice: text });
    this.later(3500, () => {
      if (this.store.get().notice === text) this.store.set({ notice: null });
    });
  }

  private pushFeed(effects: GameEvent[], nowMs: number): void {
    if (!this.lobby) return;
    let feed = this.store.get().feed;
    for (const event of effects) {
      const text = describeEvent(event, this.lobby.roster, this.lobby.settings.mode);
      if (!text || isRepeat(feed, text, nowMs, event.kind)) continue;
      this.feedId += 1;
      feed = appendFeed(feed, { id: this.feedId, kind: event.kind, text, team: event.team, at: nowMs });
    }
    if (feed !== this.store.get().feed) this.store.set({ feed });
  }
}
