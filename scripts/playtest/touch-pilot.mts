import type { CDPSession, Page } from "@playwright/test";
import { Autopilot, type Probe } from "./autopilot.mts";

const STICK_REACH = 50;

/**
 * Plays with real touch events: a held thumb on the left half drives the
 * floating joystick, a second finger taps the right half to dash.
 */
export class TouchPilot {
  dashes = 0;
  private stickDown = false;
  /** CDP never lifts a single finger out of a multi-touch, so every dash tap uses a fresh finger id. */
  private nextFingerId = 1;
  private readonly brain: Autopilot;

  private readonly cdp: CDPSession;
  private readonly origin: { x: number; y: number };
  private readonly dashPoint: { x: number; y: number };

  private constructor(page: Page, cdp: CDPSession, origin: { x: number; y: number }, dashPoint: { x: number; y: number }) {
    this.brain = new Autopilot(page);
    this.cdp = cdp;
    this.origin = origin;
    this.dashPoint = dashPoint;
  }

  static async create(page: Page): Promise<TouchPilot> {
    const cdp = await page.context().newCDPSession(page);
    const size = page.viewportSize() ?? { width: 390, height: 844 };
    return new TouchPilot(page, cdp, { x: 90, y: size.height - 170 }, { x: size.width - 70, y: size.height - 120 });
  }

  async step(probe: Probe | null): Promise<void> {
    const intent = this.brain.intent(probe);
    if (!intent) {
      await this.release();
      return;
    }
    const knob = { id: 0, x: this.origin.x + intent.dir.x * STICK_REACH, y: this.origin.y + intent.dir.y * STICK_REACH };
    if (!this.stickDown) {
      await this.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 0, ...this.origin }] });
      this.stickDown = true;
    }
    await this.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [knob] });
    if (intent.dash) {
      this.nextFingerId += 1;
      await this.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [knob, { id: this.nextFingerId, ...this.dashPoint }] });
      await this.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [knob] });
      this.dashes += 1;
    }
  }

  async release(): Promise<void> {
    if (!this.stickDown) return;
    await this.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    this.stickDown = false;
  }
}
