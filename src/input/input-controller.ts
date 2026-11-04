const UP_KEYS = new Set(["KeyW", "ArrowUp"]);
const DOWN_KEYS = new Set(["KeyS", "ArrowDown"]);
const LEFT_KEYS = new Set(["KeyA", "ArrowLeft"]);
const RIGHT_KEYS = new Set(["KeyD", "ArrowRight"]);
const DASH_KEYS = new Set(["Space", "ShiftLeft", "ShiftRight", "KeyK", "KeyJ"]);
const GAME_KEYS = new Set([...UP_KEYS, ...DOWN_KEYS, ...LEFT_KEYS, ...RIGHT_KEYS, ...DASH_KEYS]);
const GAMEPAD_DEADZONE = 0.18;
const GAMEPAD_DASH_BUTTONS = [0, 1, 5, 7];

export interface ScreenInput {
  /** Movement on screen axes, each in [-1, 1]. */
  sx: number;
  sy: number;
  dash: number;
}

const isTyping = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

/** Merges keyboard, on-screen joystick and gamepad into one input. */
export class InputController {
  private readonly keys = new Set<string>();
  private dashCount = 0;
  private stickX = 0;
  private stickY = 0;
  private padDashHeld = false;

  attach(target: Window, onEscape?: () => void): () => void {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Escape") {
        onEscape?.();
        return;
      }
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault();
      if (DASH_KEYS.has(e.code) && !e.repeat) this.dash();
      this.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const reset = () => {
      this.keys.clear();
      this.stickX = 0;
      this.stickY = 0;
    };
    target.addEventListener("keydown", down);
    target.addEventListener("keyup", up);
    target.addEventListener("blur", reset);
    return () => {
      target.removeEventListener("keydown", down);
      target.removeEventListener("keyup", up);
      target.removeEventListener("blur", reset);
    };
  }

  dash(): void {
    this.dashCount += 1;
  }

  setStick(x: number, y: number): void {
    this.stickX = x;
    this.stickY = y;
  }

  read(): ScreenInput {
    let sx = 0;
    let sy = 0;
    const pressed = (set: Set<string>) => [...set].some((k) => this.keys.has(k));
    if (pressed(LEFT_KEYS)) sx -= 1;
    if (pressed(RIGHT_KEYS)) sx += 1;
    if (pressed(UP_KEYS)) sy -= 1;
    if (pressed(DOWN_KEYS)) sy += 1;
    if (sx === 0 && sy === 0) {
      sx = this.stickX;
      sy = this.stickY;
    }
    const pad = this.readGamepad();
    if (sx === 0 && sy === 0 && pad) {
      sx = pad.x;
      sy = pad.y;
    }
    const len = Math.hypot(sx, sy);
    if (len > 1) {
      sx /= len;
      sy /= len;
    }
    return { sx, sy, dash: this.dashCount };
  }

  private readGamepad(): { x: number; y: number } | null {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
    const pad = [...navigator.getGamepads()].find((g) => g?.connected);
    if (!pad) return null;
    const dashHeld = GAMEPAD_DASH_BUTTONS.some((i) => pad.buttons[i]?.pressed);
    if (dashHeld && !this.padDashHeld) this.dash();
    this.padDashHeld = dashHeld;
    let x = pad.axes[0] ?? 0;
    let y = pad.axes[1] ?? 0;
    if (pad.buttons[14]?.pressed) x = -1;
    if (pad.buttons[15]?.pressed) x = 1;
    if (pad.buttons[12]?.pressed) y = -1;
    if (pad.buttons[13]?.pressed) y = 1;
    if (Math.hypot(x, y) < GAMEPAD_DEADZONE) return null;
    return { x, y };
  }
}
