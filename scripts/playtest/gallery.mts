/**
 * Captures a gallery of the important screens: menus, lobby, every mode in
 * action, goal celebrations, pause, match summary and the phone layout.
 * Usage: node scripts/playtest/gallery.mts <outDir> [menus|solo|duo|squad|ffa|phone ...]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { Autopilot, readProbe, type Probe } from "./autopilot.mts";
import { TouchPilot } from "./touch-pilot.mts";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const OUT = process.argv[2] ?? "playtest-out/gallery";
const DESKTOP: BrowserContextOptions = { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1.5 };
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const MODE_LABELS: Record<string, string> = { solo: "Solo 1v1", duo: "Duo 2v2", squad: "Squad 4v4", ffa: "Chaar Kone" };
const GOAL_BURST_MS = [0, 250, 600, 1000, 1500, 2200];
const STEP_MS = 45;

mkdirSync(OUT, { recursive: true });
const errors: string[] = [];
const shot = (page: Page, name: string) => page.screenshot({ path: join(OUT, `${name}.png`) });

interface Pilot {
  step: (probe: Probe | null) => Promise<void>;
  release: () => Promise<void>;
}

const open = async (browser: Browser, options: BrowserContextOptions, url: string): Promise<Page> => {
  const page = await (await browser.newContext(options)).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  return page;
};

/** Drives the pilot, snapping action every few seconds and a burst on the first goals. */
const play = async (page: Page, pilot: Pilot, tag: string, opts: { seconds: number; untilSummary?: boolean; pauseAt?: number }) => {
  const start = Date.now();
  let lastSnap = start;
  let snaps = 0;
  let goals = 0;
  let lastPhase = "";
  let paused = false;
  while (Date.now() - start < opts.seconds * 1000) {
    const probe = await readProbe(page);
    await pilot.step(probe);
    const phase = probe?.phase ?? "none";
    if (phase === "goal" && lastPhase !== "goal" && goals < 2) {
      goals += 1;
      const t0 = Date.now();
      for (const at of GOAL_BURST_MS) {
        await page.waitForTimeout(Math.max(0, t0 + at - Date.now()));
        await shot(page, `${tag}-goal${goals}-${at}ms`);
      }
    }
    if (phase === "playing" && Date.now() - lastSnap > 3000) {
      lastSnap = Date.now();
      snaps += 1;
      await shot(page, `${tag}-action-${String(snaps).padStart(2, "0")}`);
    }
    if (!paused && opts.pauseAt && Date.now() - start > opts.pauseAt * 1000 && phase === "playing") {
      paused = true;
      await pilot.release();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      await shot(page, `${tag}-pause-menu`);
      await page.getByRole("button", { name: /Resume/ }).click();
    }
    lastPhase = phase;
    if (opts.untilSummary && (await page.getByText("MVP").first().isVisible().catch(() => false))) break;
    await page.waitForTimeout(STEP_MS);
  }
  await pilot.release();
};

const startPractice = async (page: Page, mode: string) => {
  await page.getByRole("textbox").first().fill("Sanjay");
  await page.getByRole("button", { name: "Practice" }).click();
  await page.getByRole("button", { name: new RegExp(MODE_LABELS[mode]) }).click();
  await page.getByRole("radio", { name: "Khatarnak" }).click();
  await page.getByRole("radio", { name: "2 min" }).click();
  await page.getByRole("button", { name: "Bots se khelo" }).click();
};

const menus = async (browser: Browser) => {
  const page = await open(browser, DESKTOP, `${BASE}/`);
  await page.getByRole("textbox").first().fill("Sanjay");
  await page.waitForTimeout(1500);
  await shot(page, "menu-home");
  await page.getByRole("button", { name: "Kaise Khelein" }).click();
  await page.waitForTimeout(700);
  await shot(page, "menu-how-to-play");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Practice" }).click();
  await page.getByRole("button", { name: /Squad 4v4/ }).click();
  await page.getByRole("radio", { name: "Khatarnak" }).click();
  await page.waitForTimeout(500);
  await shot(page, "menu-practice");
  await page.goto(`${BASE}/?net=local&room=ZZZZ9`);
  await page.waitForTimeout(1000);
  await shot(page, "menu-invite-link");
  await page.getByRole("button", { name: "Join Karo" }).click();
  await page.getByText("Room nahi mila").waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  await shot(page, "menu-error-room-not-found");
  await page.context().close();
};

/** Host + guest in one browser over the local transport so the lobby shows real players. */
const lobby = async (browser: Browser) => {
  const context = await browser.newContext(DESKTOP);
  const host = await context.newPage();
  const guest = await context.newPage();
  for (const p of [host, guest]) p.on("pageerror", (e) => errors.push(e.message));
  await host.goto(`${BASE}/?net=local&debug=1`);
  await host.getByRole("textbox").first().fill("Raju");
  await host.getByRole("button", { name: /Room Banao/ }).click();
  const code = ((await host.locator("span.font-mono.text-4xl").textContent()) ?? "").trim();
  await host.waitForTimeout(1200);
  await shot(host, "lobby-room-created");
  await guest.goto(`${BASE}/?net=local&debug=1&room=${code}`);
  await guest.getByRole("textbox").first().fill("Shyam");
  await guest.getByRole("button", { name: "Join Karo" }).click();
  await host.getByText("Shyam", { exact: true }).waitFor();
  await host.getByRole("button", { name: /Duo 2v2/ }).click();
  await host.getByRole("radio", { name: "Bots ON" }).click();
  await host.waitForTimeout(1000);
  await shot(host, "lobby-host-duo");
  await shot(guest, "lobby-guest-view");
  await host.getByRole("button", { name: /Match Start/ }).click();
  await host.getByText("Get ready").waitFor();
  await host.waitForTimeout(400);
  await shot(host, "online-countdown");
  const guestPilot = new Autopilot(guest);
  let stop = false;
  const guestLoop = (async () => {
    while (!stop) {
      await guestPilot.step(await readProbe(guest));
      await guest.waitForTimeout(STEP_MS);
    }
    await guestPilot.release();
  })();
  await play(host, new Autopilot(host), "online-duo", { seconds: 35 });
  await shot(guest, "online-duo-guest-view");
  stop = true;
  await guestLoop;
  await context.close();
};

const practice = async (browser: Browser, mode: string, seconds: number, extra: { untilSummary?: boolean; pauseAt?: number } = {}) => {
  const page = await open(browser, DESKTOP, `${BASE}/?debug=1`);
  await startPractice(page, mode);
  await page.getByText("Get ready").waitFor();
  await page.waitForTimeout(300);
  await shot(page, `${mode}-countdown`);
  await play(page, new Autopilot(page), mode, { seconds, ...extra });
  if (extra.untilSummary) {
    await page.waitForTimeout(1500);
    await shot(page, `${mode}-summary`);
  }
  await page.context().close();
};

const phone = async (browser: Browser) => {
  const page = await open(browser, PHONE, `${BASE}/?debug=1`);
  await page.getByRole("textbox").first().fill("Sanjay");
  await page.waitForTimeout(1200);
  await shot(page, "phone-home");
  await startPractice(page, "duo");
  await page.getByText("Get ready").waitFor();
  await play(page, await TouchPilot.create(page), "phone-duo", { seconds: 40 });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1500);
  await shot(page, "phone-landscape");
  await page.context().close();
};

const browser = await chromium.launch({ channel: "chrome" });
const PARTS: Record<string, () => Promise<void>> = {
  menus: () => menus(browser).then(() => lobby(browser)),
  solo: () => practice(browser, "solo", 200, { untilSummary: true, pauseAt: 12 }),
  duo: () => practice(browser, "duo", 45),
  squad: () => practice(browser, "squad", 50),
  ffa: () => practice(browser, "ffa", 45),
  phone: () => phone(browser),
};
const chosen = process.argv.slice(3);
await Promise.all(Object.entries(PARTS).filter(([name]) => chosen.length === 0 || chosen.includes(name)).map(([, run]) => run()));
await browser.close();
console.log(JSON.stringify({ out: OUT, errors }, null, 2));
