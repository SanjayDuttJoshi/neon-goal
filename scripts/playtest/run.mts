/**
 * Automated playtest: plays real matches through the UI with a keyboard/touch
 * autopilot, records video, saves frame grabs (bursts around goals) and writes
 * a JSON report per scenario.  Usage:
 *   node scripts/playtest/run.mts <outDir> <scenario...>
 * Scenarios: solo duo squad ffa mobile lan
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Autopilot, readProbe, type Probe } from "./autopilot.mts";
import { TouchPilot } from "./touch-pilot.mts";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const OUT = process.argv[2] ?? "playtest-out";
const SCENARIOS = process.argv.slice(3);
const STEP_MS = 45;
const FRAME_EVERY_MS = 2000;
const BURST_EVERY_MS = 120;
const MATCH_TIMEOUT_MS = 14 * 60_000;

const MODE_LABELS: Record<string, string> = { solo: "Solo 1v1", duo: "Duo 2v2", squad: "Squad 4v4", ffa: "Chaar Kone" };

interface Report {
  scenario: string;
  goalsSeen: number;
  dashes: number;
  durationSec: number;
  summary: string;
  errors: string[];
  perf: Pick<Probe, "frames" | "slowFrames" | "maxFrameMs"> | null;
  notes: string[];
  /** Seconds into the recorded video where something worth watching happened. */
  moments: Array<{ t: number; what: string }>;
}

const newReport = (scenario: string): Report => ({
  scenario, goalsSeen: 0, dashes: 0, durationSec: 0, summary: "", errors: [], perf: null, notes: [], moments: [],
});

const watchErrors = (page: Page, sink: string[], tag: string) => {
  page.on("pageerror", (e) => sink.push(`[${tag}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") sink.push(`[${tag}] console.${m.type()}: ${m.text()}`);
  });
};

const newContext = (browser: Browser, dir: string, mobile: boolean): Promise<BrowserContext> =>
  browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir, size: { width: 390, height: 844 } } }
      : { viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } } },
  );

const startPractice = async (page: Page, mode: string) => {
  await page.goto(`${BASE}/?debug=1`);
  await page.getByRole("button", { name: "Practice" }).click();
  await page.getByRole("button", { name: new RegExp(MODE_LABELS[mode]) }).click();
  await page.getByRole("radio", { name: "Khatarnak" }).click();
  await page.getByRole("radio", { name: "6 min" }).click();
  await page.getByRole("button", { name: "Bots se khelo" }).click();
};

interface Pilot {
  step: (probe: Probe | null) => Promise<void>;
  release: () => Promise<void>;
  dashes: number;
}

/** Plays until the summary overlay shows; grabs frames on a timer and in bursts while a goal is celebrated. */
const playMatch = async (page: Page, pilot: Pilot, framesDir: string, report: Report, videoStart: number) => {
  mkdirSync(framesDir, { recursive: true });
  const start = Date.now();
  let lastFrame = 0;
  let lastPhase = "";
  let lastRed = 0;
  let lastEvent = "";
  let wasOut = false;
  const mark = (what: string) => report.moments.push({ t: Math.round((Date.now() - videoStart) / 100) / 10, what });
  let shot = 0;
  const grab = async (label: string) => {
    shot += 1;
    await page.screenshot({ path: join(framesDir, `${String(shot).padStart(4, "0")}-${label}.png`) });
  };
  while (Date.now() - start < MATCH_TIMEOUT_MS) {
    const probe = await readProbe(page);
    await pilot.step(probe);
    const phase = probe?.phase ?? "none";
    if (phase === "goal" && lastPhase !== "goal") {
      report.goalsSeen += 1;
      mark("goal");
    }
    if (probe && probe.ballRed > 0 && lastRed === 0) mark("red-ball");
    if (probe && probe.arenaEvent && probe.arenaEvent !== lastEvent) mark(`event ${probe.arenaEvent}`);
    if (probe?.selfOut && !wasOut) mark("self knocked out");
    lastRed = probe?.ballRed ?? 0;
    lastEvent = probe?.arenaEvent ?? "";
    wasOut = probe?.selfOut ?? false;
    const now = Date.now();
    if (phase === "goal" ? now - lastFrame > BURST_EVERY_MS : now - lastFrame > FRAME_EVERY_MS) {
      lastFrame = now;
      await grab(phase);
    }
    lastPhase = phase;
    if (await page.getByText("MVP").first().isVisible().catch(() => false)) break;
    await page.waitForTimeout(STEP_MS);
  }
  await pilot.release();
  report.dashes = pilot.dashes;
  report.durationSec = Math.round((Date.now() - start) / 1000);
  const probe = await readProbe(page);
  report.perf = probe ? { frames: probe.frames, slowFrames: probe.slowFrames, maxFrameMs: Math.round(probe.maxFrameMs) } : null;
  await page.waitForTimeout(800);
  await grab("summary");
  report.summary = (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 600);
};

const runPractice = async (browser: Browser, scenario: string, mobile: boolean): Promise<Report> => {
  const dir = join(OUT, scenario);
  const report = newReport(scenario);
  const context = await newContext(browser, dir, mobile);
  const videoStart = Date.now();
  const page = await context.newPage();
  watchErrors(page, report.errors, scenario);
  await startPractice(page, mobile ? "duo" : scenario);
  const pilot = mobile ? await TouchPilot.create(page) : new Autopilot(page);
  await playMatch(page, pilot, join(dir, "frames"), report, videoStart);
  try {
    await page.getByRole("button", { name: /Phir se khelo/ }).click({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    report.notes.push(`rematch countdown visible: ${await page.getByText("Get ready").isVisible()}`);
    await page.screenshot({ path: join(dir, "rematch.png") });
  } catch (error) {
    report.notes.push(`no summary/rematch: ${String(error).slice(0, 120)}`);
  }
  await context.close();
  return report;
};

/** Two humans over the same-browser network, both on autopilot, 1v1 with bots off. */
const runLan = async (browser: Browser): Promise<Report> => {
  const dir = join(OUT, "lan");
  const report = newReport("lan");
  const context = await newContext(browser, dir, false);
  const videoStart = Date.now();
  const host = await context.newPage();
  const guest = await context.newPage();
  watchErrors(host, report.errors, "host");
  watchErrors(guest, report.errors, "guest");
  await host.goto(`${BASE}/?net=local&debug=1`);
  await host.getByRole("textbox").first().fill("Raju");
  await host.getByRole("button", { name: /Room Banao/ }).click();
  const code = ((await host.locator("span.font-mono.text-4xl").textContent()) ?? "").trim();
  report.notes.push(`room code ${code}`);
  await guest.goto(`${BASE}/?net=local&debug=1&room=${code}`);
  await guest.getByRole("textbox").first().fill("Shyam");
  await guest.getByRole("button", { name: "Join Karo" }).click();
  await host.getByText("Shyam", { exact: true }).waitFor();
  await host.getByRole("button", { name: /Solo 1v1/ }).click();
  await host.getByRole("radio", { name: "Bots OFF" }).click();
  await host.getByRole("radio", { name: "6 min" }).click();
  await host.screenshot({ path: join(dir, "lobby-host.png") });
  await guest.screenshot({ path: join(dir, "lobby-guest.png") });
  await host.getByRole("button", { name: /Match Start/ }).click();
  const guestPilot = new Autopilot(guest);
  let stop = false;
  const guestLoop = (async () => {
    while (!stop) {
      await guestPilot.step(await readProbe(guest));
      await guest.waitForTimeout(STEP_MS);
    }
    await guestPilot.release();
  })();
  await playMatch(host, new Autopilot(host), join(dir, "frames"), report, videoStart);
  stop = true;
  await guestLoop;
  await guest.screenshot({ path: join(dir, "summary-guest.png") });
  const guestProbe = await readProbe(guest);
  report.notes.push(`guest perf ${JSON.stringify(guestProbe && { frames: guestProbe.frames, slow: guestProbe.slowFrames, max: Math.round(guestProbe.maxFrameMs) })}`);
  await context.close();
  return report;
};

const main = async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
  const reports: Report[] = [];
  for (const scenario of SCENARIOS) {
    const t0 = Date.now();
    try {
      const report = scenario === "lan" ? await runLan(browser) : await runPractice(browser, scenario, scenario === "mobile");
      reports.push(report);
    } catch (error) {
      reports.push({ ...newReport(scenario), errors: [`CRASH: ${String(error)}`] });
    }
    console.log(`${scenario} done in ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  await browser.close();
  writeFileSync(join(OUT, `report-${SCENARIOS.join("-")}.json`), JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports, null, 2));
};

await main();
