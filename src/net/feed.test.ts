import { describe, expect, it } from "vitest";
import { GameEventKind } from "@/types/game";
import type { FeedItem } from "@/types/render";
import { isRepeat } from "@/net/feed";

const item = (kind: GameEventKind, text: string, at: number): FeedItem => ({ id: at, kind, text, team: 0, at });

describe("feed throttling", () => {
  it("keeps minor moments to one every few seconds but never hides goals", () => {
    const feed = [item(GameEventKind.Save, "Kya bachaya Raju ne!", 1000)];
    expect(isRepeat(feed, "Kya bachaya Shyam ne!", 3000, GameEventKind.Save)).toBe(true);
    expect(isRepeat(feed, "Shyam ka POWER SHOT", 3000, GameEventKind.PowerBounce)).toBe(true);
    expect(isRepeat(feed, "Kya bachaya Shyam ne!", 5200, GameEventKind.Save)).toBe(false);
    expect(isRepeat(feed, "GOAL! Shyam", 1200, GameEventKind.Goal)).toBe(false);
  });

  it("drops an identical line repeated straight away", () => {
    const feed = [item(GameEventKind.Goal, "GOAL! Shyam", 1000)];
    expect(isRepeat(feed, "GOAL! Shyam", 2000, GameEventKind.Goal)).toBe(true);
    expect(isRepeat(feed, "GOAL! Shyam", 4000, GameEventKind.Goal)).toBe(false);
  });
});
