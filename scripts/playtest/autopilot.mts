import type { Page } from "@playwright/test";

/** Screen-space view of the match exposed by src/lib/debug-probe.ts (only with ?debug=1). */
export interface Probe {
  phase: string;
  self: { x: number; y: number } | null;
  ball: { x: number; y: number };
  ballVel: { x: number; y: number };
  ownGoal: { x: number; y: number } | null;
  enemyGoals: { x: number; y: number }[];
  dashReady: number;
  frames: number;
  slowFrames: number;
  maxFrameMs: number;
}

const KEY_THRESHOLD = 0.38;
const LEAD_SECONDS = 0.22;
const BEHIND_GAP = 52;
const LINE_TOLERANCE = 30;
const DASH_RANGE = 150;

const norm = (x: number, y: number) => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

export const readProbe = (page: Page): Promise<Probe | null> => page.evaluate(() => (window as unknown as { __neonProbe?: Probe }).__neonProbe ?? null);

/**
 * A "pro" keyboard player: gets behind the ball on the line to the enemy goal,
 * then drives through it and dashes for a power hit. Falls back to defending
 * when the ball is heading to its own goal.
 */
export class Autopilot {
  private held = new Set<string>();
  dashes = 0;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Where to steer (unit screen direction) and whether to dash right now; null when not playing. */
  intent(probe: Probe | null): { dir: { x: number; y: number }; dash: boolean } | null {
    if (!probe || !probe.self || probe.phase !== "playing" || probe.enemyGoals.length === 0) return null;
    const s = probe.self;
    const b = { x: probe.ball.x + probe.ballVel.x * LEAD_SECONDS, y: probe.ball.y + probe.ballVel.y * LEAD_SECONDS };
    const goal = probe.enemyGoals.reduce((best, g) => (Math.hypot(g.x - b.x, g.y - b.y) < Math.hypot(best.x - b.x, best.y - b.y) ? g : best));
    const toGoal = norm(goal.x - b.x, goal.y - b.y);
    const rel = { x: s.x - b.x, y: s.y - b.y };
    const along = rel.x * toGoal.x + rel.y * toGoal.y;
    const lateral = rel.x * -toGoal.y + rel.y * toGoal.x;
    let target: { x: number; y: number };
    let attack = false;
    if (along < -10 && Math.abs(lateral) < LINE_TOLERANCE) {
      target = { x: b.x + toGoal.x * 80, y: b.y + toGoal.y * 80 };
      attack = true;
    } else if (along < -10) {
      target = { x: b.x - toGoal.x * BEHIND_GAP, y: b.y - toGoal.y * BEHIND_GAP };
    } else {
      const side = lateral >= 0 ? 1 : -1;
      target = {
        x: b.x - toGoal.x * BEHIND_GAP + -toGoal.y * side * 70,
        y: b.y - toGoal.y * BEHIND_GAP + toGoal.x * side * 70,
      };
    }
    const dist = Math.hypot(b.x - s.x, b.y - s.y);
    return { dir: norm(target.x - s.x, target.y - s.y), dash: attack && dist < DASH_RANGE && probe.dashReady >= 1 };
  }

  async step(probe: Probe | null): Promise<void> {
    const intent = this.intent(probe);
    const keys = new Set<string>();
    if (intent) {
      if (intent.dir.x > KEY_THRESHOLD) keys.add("KeyD");
      if (intent.dir.x < -KEY_THRESHOLD) keys.add("KeyA");
      if (intent.dir.y > KEY_THRESHOLD) keys.add("KeyS");
      if (intent.dir.y < -KEY_THRESHOLD) keys.add("KeyW");
    }
    await this.setKeys(keys);
    if (intent?.dash) {
      await this.page.keyboard.press("Space");
      this.dashes += 1;
    }
  }

  async release(): Promise<void> {
    await this.setKeys(new Set());
  }

  private async setKeys(next: Set<string>): Promise<void> {
    for (const key of this.held) if (!next.has(key)) await this.page.keyboard.up(key);
    for (const key of next) if (!this.held.has(key)) await this.page.keyboard.down(key);
    this.held = next;
  }
}
