import { expect, test, type Page } from "@playwright/test";

interface ProbeLite {
  phase: string;
  ownGoal: { x: number; y: number } | null;
  enemyGoals: { x: number; y: number }[];
}

const readProbe = (page: Page) => page.evaluate(() => (window as unknown as { __neonProbe?: ProbeLite }).__neonProbe ?? null);

const collectErrors = (page: Page, sink: string[]) => {
  page.on("pageerror", (e) => sink.push(e.message));
  page.on("dialog", (d) => {
    sink.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
};

const createRoom = async (page: Page, name: string): Promise<string> => {
  await page.goto("/?net=local&debug=1");
  await page.getByRole("textbox").first().fill(name);
  await page.getByRole("button", { name: /Room Banao/ }).click();
  const code = page.locator("span.font-mono.text-4xl");
  await expect(code).toHaveText(/^[A-Z2-9]{5}$/);
  return (await code.textContent())?.trim() ?? "";
};

const joinRoom = async (page: Page, code: string, name: string) => {
  await page.goto(`/?net=local&debug=1&room=${code}`);
  await page.getByRole("textbox").first().fill(name);
  await page.getByRole("button", { name: "Join Karo" }).click();
};

test("a guest who refreshes mid-match lands back in their own slot", async ({ browser }) => {
  const errors: string[] = [];
  const context = await browser.newContext();
  const [host, guest] = [await context.newPage(), await context.newPage()];
  [host, guest].forEach((p) => collectErrors(p, errors));
  const code = await createRoom(host, "Host");
  await joinRoom(guest, code, "Shyam");
  await expect(host.getByText("Shyam", { exact: true })).toBeVisible();
  await host.getByRole("button", { name: /Match Start/ }).click();
  await expect(guest.getByText("Get ready")).toBeHidden({ timeout: 8000 });
  await guest.reload();
  await expect(guest.locator("canvas")).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => (await readProbe(guest))?.ownGoal !== null, { timeout: 10000 }).toBe(true);
  await expect(guest.getByText("Spectator mode")).toBeHidden();
  await expect(host.getByText("Shyam 2")).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});

test("someone joining mid-match watches as a spectator", async ({ browser }) => {
  const context = await browser.newContext();
  const [host, late] = [await context.newPage(), await context.newPage()];
  const code = await createRoom(host, "Host");
  await host.getByRole("button", { name: /Match Start/ }).click();
  await expect(host.getByText("Get ready")).toBeVisible();
  await joinRoom(late, code, "Latecomer");
  await expect(late.getByText(/Spectator mode/)).toBeVisible({ timeout: 10000 });
  await context.close();
});

test("a kicked player cannot sneak back in, and hostile names are neutralised", async ({ browser }) => {
  const errors: string[] = [];
  const context = await browser.newContext();
  const [host, guest] = [await context.newPage(), await context.newPage()];
  [host, guest].forEach((p) => collectErrors(p, errors));
  const code = await createRoom(host, "Host");
  await joinRoom(guest, code, "<img src=x onerror=alert(1)>");
  const row = host.getByText("img src=x one", { exact: true });
  await expect(row).toBeVisible();
  await host.getByTitle("Kick").click();
  await expect(guest.getByText("Room se nikaal diya")).toBeVisible();
  await joinRoom(guest, code, "Again");
  await expect(guest.getByText("Room se nikaal diya")).toBeVisible({ timeout: 10000 });
  await expect(host.getByText("Again")).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});

test("host settings show up live for guests", async ({ browser }) => {
  const context = await browser.newContext();
  const [host, guest] = [await context.newPage(), await context.newPage()];
  const code = await createRoom(host, "Host");
  await joinRoom(guest, code, "Guest");
  await host.getByRole("button", { name: /Squad 4v4/ }).click();
  await host.getByRole("radio", { name: "10 min" }).click();
  await host.getByRole("radio", { name: "Red 6s" }).click();
  await host.getByRole("radio", { name: "Events OFF" }).click();
  await expect(guest.getByRole("button", { name: /Squad 4v4/ })).toHaveAttribute("aria-pressed", "true");
  await expect(guest.getByRole("radio", { name: "10 min" })).toHaveAttribute("aria-checked", "true");
  await expect(guest.getByRole("radio", { name: "Red 6s" })).toHaveAttribute("aria-checked", "true");
  await expect(guest.getByRole("radio", { name: "Events OFF" })).toHaveAttribute("aria-checked", "true");
  await expect(guest.getByRole("button", { name: /Squad 4v4/ })).toBeDisabled();
  await expect(guest.getByRole("radio", { name: "Red 12s" })).toBeDisabled();
  await context.close();
});

test("a room that does not exist gives a clear error with retry", async ({ page }) => {
  test.setTimeout(40_000);
  await page.goto("/?net=local&room=ZZZZ9");
  await page.getByRole("button", { name: "Join Karo" }).click();
  await expect(page.getByText("Connect ho raha hai")).toBeVisible();
  await expect(page.getByText("Room nahi mila")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: /try/i })).toBeVisible();
});

test("turning the phone sideways rotates the field and keeps your goal on your side", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?debug=1");
  await page.getByRole("button", { name: "Practice" }).click();
  await page.getByRole("button", { name: "Bots se khelo" }).click();
  await expect.poll(async () => (await readProbe(page))?.ownGoal ?? null).not.toBeNull();
  const wide = await readProbe(page);
  expect(wide!.ownGoal!.x).toBeLessThan(wide!.enemyGoals[0].x);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const p = await readProbe(page);
      return p ? p.ownGoal!.y > p.enemyGoals[0].y : false;
    })
    .toBe(true);
});

test("mute choice survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice" }).click();
  await page.getByRole("button", { name: "Bots se khelo" }).click();
  await page.getByRole("button", { name: "Mute" }).click();
  await expect(page.getByRole("button", { name: "Unmute" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Practice" }).click();
  await page.getByRole("button", { name: "Bots se khelo" }).click();
  await expect(page.getByRole("button", { name: "Unmute" })).toBeVisible();
});
