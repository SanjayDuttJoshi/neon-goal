/**
 * Real-internet smoke test: two separate browser profiles meet through the
 * free public Nostr relays (no ?net=local), play for a few seconds and report
 * join time, ping and errors.  Usage: node scripts/playtest/online-check.mts <outDir>
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { Autopilot, readProbe } from "./autopilot.mts";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const OUT = process.argv[2] ?? "playtest-out/online";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const errors: string[] = [];
const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const host = await hostCtx.newPage();
const guest = await guestCtx.newPage();
for (const [tag, page] of [["host", host], ["guest", guest]] as const) {
  page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${tag}: HTTP ${r.status()} ${r.url()}`);
  });
}

await host.goto(`${BASE}/?debug=1`);
await host.getByRole("textbox").first().fill("Online Host");
await host.getByRole("button", { name: /Room Banao/ }).click();
const code = ((await host.locator("span.font-mono.text-4xl").textContent({ timeout: 20000 })) ?? "").trim();
const t0 = Date.now();
await guest.goto(`${BASE}/?debug=1&room=${code}`);
await guest.getByRole("textbox").first().fill("Online Guest");
await guest.getByRole("button", { name: "Join Karo" }).click();
await host.getByText("Online Guest", { exact: true }).waitFor({ timeout: 30000 });
const joinMs = Date.now() - t0;
await host.getByRole("button", { name: /Solo 1v1/ }).click();
await host.getByRole("button", { name: /Match Start/ }).click();
await guest.getByText("Get ready").waitFor({ timeout: 15000 });
const pilots = [new Autopilot(host), new Autopilot(guest)];
const end = Date.now() + 15000;
while (Date.now() < end) {
  await pilots[0].step(await readProbe(host));
  await pilots[1].step(await readProbe(guest));
  await host.waitForTimeout(40);
}
await host.screenshot({ path: join(OUT, "online-host.png") });
await guest.screenshot({ path: join(OUT, "online-guest.png") });
const ping = await guest.locator("span", { hasText: /\d+ms/ }).first().textContent().catch(() => null);
const probe = await readProbe(guest);
console.log(JSON.stringify({ code, joinMs, guestPing: ping, guestPhase: probe?.phase, guestFrames: probe?.frames, errors }, null, 2));
await browser.close();
