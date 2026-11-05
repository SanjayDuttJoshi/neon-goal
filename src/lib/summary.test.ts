import { describe, expect, it } from "vitest";
import { GameMode, type PlayerStats } from "@/types/game";
import type { MatchSummary, SummaryPlayer } from "@/types/net";
import { pickMvp, resultHeadline, scoreLine } from "@/lib/summary";

const player = (id: string, team: number, stats: Partial<PlayerStats>): SummaryPlayer => ({
  id,
  name: id,
  team,
  isBot: false,
  stats: { goals: 0, ownGoals: 0, saves: 0, bounces: 0, powerShots: 0, knockouts: 0, ...stats },
});

const summary = (players: SummaryPlayer[]): MatchSummary => ({ winner: 0, scores: [3, 2], lives: [], mode: GameMode.Duo, players });

describe("match summary", () => {
  it("makes the goal scorer MVP over someone who only bounced the ball a lot", () => {
    const scorer = player("scorer", 0, { goals: 2, bounces: 40 });
    const busy = player("busy", 1, { saves: 3, bounces: 300, powerShots: 120 });
    expect(pickMvp(summary([busy, scorer]))?.id).toBe("scorer");
  });

  it("writes headlines and score lines", () => {
    const s = summary([]);
    expect(resultHeadline(s, 0)).toContain("JEETE");
    expect(resultHeadline(s, 1)).toContain("HAAR");
    expect(resultHeadline(s, null)).toBe("Cyan JEETA!");
    expect(scoreLine(s)).toBe("3 — 2");
  });
});
