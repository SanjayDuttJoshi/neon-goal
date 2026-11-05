import { describe, expect, it } from "vitest";
import { ArenaEventKind, ArenaEventStage, BotDifficulty, GameMode, MatchPhase, RedBallMode, type RosterEntry } from "@/types/game";
import { HEAT_TO_RED, RESPAWN_SHIELD_SECONDS } from "@/game/constants";
import { makeMatch, makeRoster, runTicks, skipCountdown } from "@/game/test-helpers";
import { decodeSnapshot, encodeSnapshot } from "@/net/protocol";
import { resumeFromSnapshot } from "@/net/resume";

const V2_RULES = { redBall: RedBallMode.Long, arenaEvents: true };

const v2State = () => {
  const state = makeMatch(GameMode.Duo, true, BotDifficulty.Normal, 360, 5, V2_RULES);
  skipCountdown(state);
  runTicks(state, 20);
  state.ball.heat = HEAT_TO_RED[GameMode.Duo] / 2;
  state.ball.redLeft = 4;
  state.ball.redTime = 6;
  state.arenaEvent = { kind: ArenaEventKind.Ice, stage: ArenaEventStage.Active, timer: 4.5, nextIn: 0, lastKind: null };
  state.players[1].outTime = 7.25;
  state.players[2].shieldTime = 1;
  state.players[3].stats.knockouts = 3;
  return state;
};

const roundTrip = (roster: RosterEntry[]) => {
  const state = v2State();
  const wire = encodeSnapshot(state, { matchId: 9, lastSeqs: new Map(), events: [], includeStats: true });
  return { state, snap: decodeSnapshot(JSON.parse(JSON.stringify(wire)), roster) };
};

describe("V2 snapshots", () => {
  it("carry the red ball, knock-outs, shields and the arena event to guests", () => {
    const { snap } = roundTrip(makeRoster(GameMode.Duo, true));
    expect(snap?.ball.redLeft).toBe(4);
    expect(snap?.ball.heat).toBeCloseTo(0.5, 2);
    expect(snap?.arenaEvent).toEqual({ kind: ArenaEventKind.Ice, stage: ArenaEventStage.Active, timer: 4.5 });
    expect(snap?.players[1].outTime).toBeCloseTo(7.3, 1);
    expect(snap?.players[2].shielded).toBe(true);
    expect(snap?.stats?.[3].knockouts).toBe(3);
  });

  it("rejects snapshots with a malformed arena event", () => {
    const state = v2State();
    const wire = encodeSnapshot(state, { matchId: 9, lastSeqs: new Map(), events: [], includeStats: false });
    expect(decodeSnapshot({ ...wire, ae: [99, 0, 0] }, makeRoster(GameMode.Duo, true))).toBeNull();
    expect(decodeSnapshot({ ...wire, ae: undefined }, makeRoster(GameMode.Duo, true))).toBeNull();
  });

  it("lets a new host resume with the red ball, events and knock-outs intact", () => {
    const roster = makeRoster(GameMode.Duo, true);
    const { state, snap } = roundTrip(roster);
    if (!snap) throw new Error("snapshot did not decode");
    const resumed = resumeFromSnapshot(state.config, roster, snap, snap.stats, 1);
    expect(resumed.ball.redLeft).toBe(4);
    expect(resumed.ball.heat).toBe(HEAT_TO_RED[GameMode.Duo] / 2);
    expect(resumed.arenaEvent.kind).toBe(ArenaEventKind.Ice);
    expect(resumed.players[1].outTime).toBeCloseTo(7.3, 1);
    expect(resumed.players[2].shieldTime).toBe(RESPAWN_SHIELD_SECONDS);
    expect(resumed.phase).toBe(MatchPhase.Countdown);
  });
});
