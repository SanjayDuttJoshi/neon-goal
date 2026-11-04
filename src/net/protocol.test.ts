import { describe, expect, it } from "vitest";
import { BotDifficulty, GameEventKind, GameMode } from "@/types/game";
import { LobbyStatus, type LobbyState } from "@/types/net";
import { decodeInput, decodeSnapshot, encodeInput, encodeSnapshot, PROTOCOL_VERSION } from "@/net/protocol";
import { addMember, applySettings, buildRoster, canStart, createLobby, markDisconnected, moveMember, sanitizeName } from "@/net/lobby";
import { parseHello, parseLobby } from "@/net/lobby-codec";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "@/net/room-code";
import { pushEvent } from "@/game/events";
import { makeMatch, makeRoster, runTicks, skipCountdown } from "@/game/test-helpers";

const lobbyWith = (count: number, mode = GameMode.Duo): LobbyState => {
  let lobby = createLobby("ABCDE", { peerId: "p0", clientId: "c0", name: "Host", team: 0, connected: true }, {
    mode,
    durationSec: 180,
    botFill: true,
    botDifficulty: BotDifficulty.Normal,
  });
  for (let i = 1; i < count; i += 1) lobby = addMember(lobby, `p${i}`, `c${i}`, `Player ${i}`);
  return lobby;
};

describe("wire protocol", () => {
  it("round-trips inputs and rejects junk", () => {
    expect(decodeInput(encodeInput(7, { mx: 0.5, my: -1, dash: 3 }))).toEqual({ seq: 7, input: { mx: 0.5, my: -1, dash: 3 } });
    expect(decodeInput("hack")).toBeNull();
    expect(decodeInput([1, 2, 3])).toBeNull();
    expect(decodeInput([1, Number.NaN, 0, 0])).toBeNull();
  });

  it("round-trips a snapshot with events and stats", () => {
    const state = makeMatch(GameMode.Duo, true);
    skipCountdown(state);
    runTicks(state, 30);
    pushEvent(state, { kind: GameEventKind.Goal, x: 10, y: 20, team: 1, playerId: state.players[2].id, otherId: "own" });
    const roster = makeRoster(GameMode.Duo, true);
    const wire = encodeSnapshot(state, { matchId: 3, lastSeqs: new Map([["p0-0", 42]]), events: state.events, includeStats: true });
    const decoded = decodeSnapshot(JSON.parse(JSON.stringify(wire)), roster);
    expect(decoded?.tick).toBe(state.tick);
    expect(decoded?.players[0].lastSeq).toBe(42);
    expect(decoded?.players[1].x).toBeCloseTo(state.players[1].x, 0);
    expect(decoded?.events.at(-1)?.playerId).toBe(state.players[2].id);
    expect(decoded?.events.at(-1)?.otherId).toBe("own");
    expect(decoded?.stats).toHaveLength(4);
  });

  it("rejects snapshots that point at players outside the roster", () => {
    const state = makeMatch(GameMode.Duo, true);
    const wire = encodeSnapshot(state, { matchId: 1, lastSeqs: new Map(), events: [], includeStats: false });
    expect(decodeSnapshot(wire, makeRoster(GameMode.Solo, true))).toBeNull();
    expect(decodeSnapshot({ ...wire, ph: "dance" }, makeRoster(GameMode.Duo, true))).toBeNull();
    expect(decodeSnapshot(null, [])).toBeNull();
  });
});

describe("lobby rules", () => {
  it("balances teams, dedupes names and benches overflow", () => {
    let lobby = lobbyWith(4);
    expect(lobby.members.map((m) => m.team)).toEqual([0, 1, 0, 1]);
    lobby = addMember(lobby, "p9", "c9", "Host");
    expect(lobby.members.at(-1)?.name).toBe("Host 2");
    expect(lobby.members.at(-1)?.team).toBeNull();
    const solo = applySettings(lobby, { ...lobby.settings, mode: GameMode.Solo });
    expect(solo.members.filter((m) => m.team !== null)).toHaveLength(2);
    const squad = applySettings(solo, { ...solo.settings, mode: GameMode.Squad });
    expect(squad.members.filter((m) => m.team === null)).toHaveLength(3);
  });

  it("refuses moving into a full team or an invalid team", () => {
    const lobby = lobbyWith(4);
    expect(moveMember(lobby, "p0", 1)).toBe(lobby);
    expect(moveMember(lobby, "p0", 7)).toBe(lobby);
    expect(moveMember(lobby, "p0", null).members[0].team).toBeNull();
  });

  it("fills empty slots with bots only when bots are on", () => {
    const lobby = lobbyWith(1, GameMode.Squad);
    expect(buildRoster(lobby)).toHaveLength(8);
    const noBots = applySettings(lobby, { ...lobby.settings, botFill: false });
    expect(buildRoster(noBots)).toHaveLength(1);
    expect(canStart(noBots).ok).toBe(false);
  });

  it("keeps a disconnected player's slot during a match but drops them in the lobby", () => {
    const lobby = lobbyWith(2);
    expect(markDisconnected(lobby, "p1").members).toHaveLength(1);
    const playing: LobbyState = { ...lobby, status: LobbyStatus.Playing, roster: buildRoster(lobby) };
    const left = markDisconnected(playing, "p1");
    expect(left.members.find((m) => m.peerId === "p1")?.connected).toBe(false);
    const back = addMember(left, "p1-new", "c1", "Player 1");
    expect(back.members.find((m) => m.clientId === "c1")).toMatchObject({ peerId: "p1-new", connected: true, team: 1 });
  });

  it("sanitises names and parses untrusted messages", () => {
    expect(sanitizeName("  <script>  Raju\u0000  ")).toBe("script Raju");
    expect(sanitizeName("     ")).toBe("Player");
    expect(sanitizeName("a".repeat(40))).toHaveLength(14);
    expect(parseHello({ v: PROTOCOL_VERSION, clientId: "abcd1234", name: "X" })).not.toBeNull();
    expect(parseHello({ v: "1", clientId: "abcd1234", name: "X" })).toBeNull();
    expect(parseLobby(JSON.parse(JSON.stringify(lobbyWith(3))))?.members).toHaveLength(3);
    expect(parseLobby({ ...lobbyWith(1), members: "nope" })).toBeNull();
  });
});

describe("room codes", () => {
  it("generates readable valid codes and normalises input", () => {
    for (let i = 0; i < 200; i += 1) expect(isValidRoomCode(generateRoomCode())).toBe(true);
    expect(normalizeRoomCode(" k7q-x2 ")).toBe("K7QX2");
    expect(isValidRoomCode("K0QX2")).toBe(false);
    expect(isValidRoomCode("K7QX")).toBe(false);
  });
});
