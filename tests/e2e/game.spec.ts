import { expect, test, type Page } from "@playwright/test";

const CLOCK = /^\s*\d:\d\d\s*$/;

const collectErrors = (page: Page, sink: string[]) => {
  page.on("pageerror", (e) => sink.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") sink.push(m.text());
  });
};

const createRoom = async (page: Page, name: string): Promise<string> => {
  await page.goto("/?net=local");
  await page.getByRole("textbox").first().fill(name);
  await page.getByRole("button", { name: /Room Banao/ }).click();
  const code = page.locator("span.font-mono.text-4xl");
  await expect(code).toHaveText(/^[A-Z2-9]{5}$/);
  return (await code.textContent())?.trim() ?? "";
};

const joinRoom = async (page: Page, code: string, name: string) => {
  await page.goto(`/?net=local&room=${code}`);
  await page.getByRole("textbox").first().fill(name);
  await page.getByRole("button", { name: "Join Karo" }).click();
};

test("practice match starts, plays and pauses", async ({ page }) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/");
  await page.getByRole("button", { name: "Practice" }).click();
  await page.getByRole("button", { name: "Bots se khelo" }).click();
  await expect(page.getByText("Get ready")).toBeVisible();
  await expect(page.getByText("Get ready")).toBeHidden({ timeout: 6000 });
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(500);
  await page.keyboard.press("Space");
  await page.keyboard.up("KeyD");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
  const frozen = await page.locator("span.font-mono").filter({ hasText: CLOCK }).first().textContent();
  await page.waitForTimeout(2200);
  await expect(page.locator("span.font-mono").filter({ hasText: CLOCK }).first()).toHaveText(frozen ?? "");
  await page.getByRole("button", { name: /Resume/ }).click();
  expect(errors).toEqual([]);
});

test("friends join with an invite link, play, and survive the host leaving", async ({ browser }) => {
  const errors: string[] = [];
  const context = await browser.newContext();
  const [host, guestA, guestB] = [await context.newPage(), await context.newPage(), await context.newPage()];
  [host, guestA, guestB].forEach((p) => collectErrors(p, errors));
  const code = await createRoom(host, "Host");
  await joinRoom(guestA, code, "Aman");
  await joinRoom(guestB, code, "Bunny");
  await expect(host.getByText("Aman", { exact: true })).toBeVisible();
  await expect(host.getByText("Bunny", { exact: true })).toBeVisible();
  await expect(guestA.getByText("Host ke start ka intezaar")).toBeVisible();
  await host.getByRole("button", { name: /Match Start/ }).click();
  await expect(guestA.getByText("Get ready")).toBeVisible();
  await expect(guestA.getByText("Get ready")).toBeHidden({ timeout: 6000 });
  await guestA.keyboard.down("KeyW");
  await guestA.waitForTimeout(600);
  await guestA.keyboard.up("KeyW");
  await host.close();
  await expect(guestB.getByText("Get ready")).toBeVisible({ timeout: 8000 });
  await expect(guestB.getByText("Get ready")).toBeHidden({ timeout: 6000 });
  const clockA = guestA.locator("span.font-mono").filter({ hasText: CLOCK }).first();
  const before = await clockA.textContent();
  await guestA.waitForTimeout(2500);
  expect(await clockA.textContent()).not.toBe(before);
  expect(errors).toEqual([]);
  await context.close();
});

test("an invalid room code is rejected before connecting", async ({ page }) => {
  await page.goto("/?room=K0QX2");
  await expect(page.getByText("Code galat lag raha hai")).toBeVisible();
  await expect(page.getByRole("button", { name: "Join Karo" })).toBeDisabled();
});
