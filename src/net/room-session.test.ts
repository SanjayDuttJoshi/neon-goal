import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BotDifficulty, GameMode, MatchPhase, RedBallMode } from "@/types/game";
import { LobbyStatus, SessionError, SessionStatus, TransportKind, type LobbySettings } from "@/types/net";
import { MemoryHub } from "@/net/memory-hub";
import { RoomSession } from "@/net/room-session";

const SETTINGS: LobbySettings = {
  mode: GameMode.Duo,
  durationSec: 360,
  botFill: true,
  botDifficulty: BotDifficulty.Normal,
  redBall: RedBallMode.Long,
  arenaEvents: true,
};

const setup = (hub: MemoryHub, clientId: string) =>
  new RoomSession(clientId, async () => hub.connect());

const wait = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
};

describe("room session over an in-memory network", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "performance"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a room, lets friends join with the code and assigns teams", async () => {
    const hub = new MemoryHub();
    const host = setup(hub, "client-host");
    await host.hostRoom("Sanjay", TransportKind.Local, SETTINGS);
    const code = host.getUi().lobby?.roomCode ?? "";
    expect(code).toHaveLength(5);
    const guestA = setup(hub, "client-a");
    const guestB = setup(hub, "client-b");
    await guestA.joinRoom("Rahul", TransportKind.Local, code);
    await guestB.joinRoom("Sanjay", TransportKind.Local, code);
    await wait(200);
    const lobby = host.getUi().lobby;
    expect(lobby?.members.map((m) => m.name)).toEqual(["Sanjay", "Rahul", "Sanjay 2"]);
    expect(lobby?.members.map((m) => m.team)).toEqual([0, 1, 0]);
    expect(guestA.getUi().status).toBe(SessionStatus.Lobby);
    expect(guestB.getUi().lobby?.members).toHaveLength(3);
    [host, guestA, guestB].forEach((s) => s.leave());
  });

  it("plays a networked match: guests get snapshots and their input moves them", async () => {
    const hub = new MemoryHub();
    const host = setup(hub, "client-host");
    await host.hostRoom("Host", TransportKind.Local, SETTINGS);
    const guest = setup(hub, "client-g");
    await guest.joinRoom("Guest", TransportKind.Local, host.getUi().lobby?.roomCode ?? "");
    await wait(200);
    host.startMatch();
    await wait(200);
    expect(guest.getUi().status).toBe(SessionStatus.InMatch);
    expect(guest.getUi().lobby?.roster).toHaveLength(4);
    await wait(3300);
    const before = guest.frame(performance.now()).frame?.players.find((p) => p.isSelf);
    guest.setInput({ mx: 0, my: -1, dash: 0 });
    await wait(1000);
    const after = guest.frame(performance.now()).frame?.players.find((p) => p.isSelf);
    expect(before && after).toBeTruthy();
    expect((before?.y ?? 0) - (after?.y ?? 0)).toBeGreaterThan(150);
    expect(guest.getUi().hud?.phase).toBe(MatchPhase.Playing);
    [host, guest].forEach((s) => s.leave());
  });

  it("hands the match to a guest when the host disappears", async () => {
    const hub = new MemoryHub();
    const host = setup(hub, "client-host");
    await host.hostRoom("Host", TransportKind.Local, SETTINGS);
    const code = host.getUi().lobby?.roomCode ?? "";
    const a = setup(hub, "client-a");
    const b = setup(hub, "client-b");
    await a.joinRoom("A", TransportKind.Local, code);
    await b.joinRoom("B", TransportKind.Local, code);
    await wait(200);
    host.startMatch();
    await wait(5000);
    const hostPeer = host.getUi().selfPeerId;
    hub.drop(hostPeer);
    host.leave();
    await wait(500);
    const newHost = [a, b].find((s) => s.getUi().isHost);
    const other = [a, b].find((s) => !s.getUi().isHost);
    expect(newHost).toBeDefined();
    await wait(4500);
    expect(other?.getUi().lobby?.hostPeerId).toBe(newHost?.getUi().selfPeerId);
    expect(other?.getUi().lobby?.status).toBe(LobbyStatus.Playing);
    expect([MatchPhase.Playing, MatchPhase.GoalScored]).toContain(other?.getUi().hud?.phase);
    [a, b].forEach((s) => s.leave());
  });

  it("reports a missing room and an invalid code", async () => {
    const hub = new MemoryHub();
    const lonely = setup(hub, "client-x");
    await lonely.joinRoom("X", TransportKind.Local, "ABCDE");
    await wait(16000);
    expect(lonely.getUi().error).toBe(SessionError.RoomNotFound);
    const bad = setup(hub, "client-y");
    await bad.joinRoom("Y", TransportKind.Local, "AB1");
    expect(bad.getUi().error).toBe(SessionError.InvalidCode);
  });

  it("kicks a player and refuses them afterwards", async () => {
    const hub = new MemoryHub();
    const host = setup(hub, "client-host");
    await host.hostRoom("Host", TransportKind.Local, SETTINGS);
    const code = host.getUi().lobby?.roomCode ?? "";
    const troll = setup(hub, "client-troll");
    await troll.joinRoom("Troll", TransportKind.Local, code);
    await wait(200);
    const trollPeer = troll.getUi().selfPeerId;
    host.kick(trollPeer);
    await wait(200);
    expect(troll.getUi().error).toBe(SessionError.Kicked);
    expect(host.getUi().lobby?.members).toHaveLength(1);
    const again = setup(hub, "client-troll");
    await again.joinRoom("Troll", TransportKind.Local, code);
    await wait(200);
    expect(again.getUi().error).toBe(SessionError.Kicked);
    host.leave();
  });

  it("puts late joiners on the bench during a match and lets a refreshed player reclaim their slot", async () => {
    const hub = new MemoryHub();
    const host = setup(hub, "client-host");
    await host.hostRoom("Host", TransportKind.Local, SETTINGS);
    const code = host.getUi().lobby?.roomCode ?? "";
    const g = setup(hub, "client-g");
    await g.joinRoom("G", TransportKind.Local, code);
    await wait(200);
    host.startMatch();
    await wait(300);
    const late = setup(hub, "client-late");
    await late.joinRoom("Late", TransportKind.Local, code);
    await wait(300);
    expect(host.getUi().lobby?.members.find((m) => m.clientId === "client-late")?.team).toBeNull();
    hub.drop(g.getUi().selfPeerId);
    g.leave();
    await wait(300);
    expect(host.getUi().lobby?.members.find((m) => m.clientId === "client-g")?.connected).toBe(false);
    const back = setup(hub, "client-g");
    await back.joinRoom("G", TransportKind.Local, code);
    await wait(300);
    expect(host.getUi().lobby?.members.find((m) => m.clientId === "client-g")?.connected).toBe(true);
    expect(back.getUi().status).toBe(SessionStatus.InMatch);
    [host, late, back].forEach((s) => s.leave());
  });

  it("runs a practice match offline against bots and can pause", async () => {
    const practice = new RoomSession("solo", async () => hubless());
    practice.startPractice("Me", { ...SETTINGS, mode: GameMode.Solo });
    await wait(500);
    expect(practice.getUi().isPractice).toBe(true);
    expect(practice.getUi().status).toBe(SessionStatus.InMatch);
    practice.togglePause();
    const t1 = practice.frame(performance.now()).frame?.time;
    await wait(1000);
    expect(practice.frame(performance.now()).frame?.time).toBeCloseTo(t1 ?? 0, 3);
    practice.leave();
  });
});

const hubless = () => new MemoryHub().connect();
