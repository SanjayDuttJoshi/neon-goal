/**
 * Publishes the game to GitHub Pages (free). Each major version lives in its
 * own folder and older ones stay online:
 *   /neon-goal/      -> pick a version (old ?room= links go to v1)
 *   /neon-goal/v1/   -> V1 classic, frozen
 *   /neon-goal/vN/   -> this build (N = major version in package.json)
 * Steps: type-check + unit tests, build for /neon-goal/vN, update the gh-pages
 * branch keeping every other vX/ folder, push, then rebuild the normal local copy.
 * Usage: npm run deploy   (SEED_V1_DIR=<built v1 folder> once, to add a missing v1)
 *
 * Pushes use the repo's own git identity and credential helper (set once with
 * `git config --local`), so whichever GitHub account is active in `gh` doesn't matter.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { landingHtml } from "./pages-landing.mts";

const SITE_PATH = "/neon-goal";
const BRANCH = "gh-pages";
const VERSION_DIR = /^v\d+$/;

const run = (cmd: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", ...options });
const read = (args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trim();

const remote = read(["remote", "get-url", "origin"]);
const name = read(["config", "user.name"]);
const email = read(["config", "user.email"]);
const helper = read(["config", "--local", "--get-all", "credential.helper"]).split("\n").filter(Boolean).pop() ?? "";
const major = Number(JSON.parse(readFileSync("package.json", "utf8")).version.split(".")[0]);
const folder = `v${major}`;

const gitIn = (cwd: string, ...args: string[]) =>
  run("git", ["-c", `user.name=${name}`, "-c", `user.email=${email}`, "-c", "credential.helper=", "-c", `credential.helper=${helper}`, ...args], { cwd });

run("npx", ["tsc", "--noEmit"]);
run("npx", ["vitest", "run"]);

const dir = mkdtempSync(join(tmpdir(), "neon-pages-"));
try {
  run("npm", ["run", "build"], {
    env: { ...process.env, PAGES_BASE_PATH: `${SITE_PATH}/${folder}`, NEXT_PUBLIC_CLASSIC_URL: major > 1 ? `${SITE_PATH}/v1/` : "" },
  });
  gitIn(process.cwd(), "clone", "--quiet", "--depth", "1", "--branch", BRANCH, remote, dir);
  for (const entry of readdirSync(dir)) {
    if (entry !== ".git" && !VERSION_DIR.test(entry)) rmSync(join(dir, entry), { recursive: true, force: true });
  }
  const seedV1 = process.env.SEED_V1_DIR;
  if (seedV1 && !existsSync(join(dir, "v1"))) cpSync(seedV1, join(dir, "v1"), { recursive: true });
  rmSync(join(dir, folder), { recursive: true, force: true });
  cpSync("out", join(dir, folder), { recursive: true });
  const versions = readdirSync(dir).filter((entry) => VERSION_DIR.test(entry));
  writeFileSync(join(dir, "index.html"), landingHtml(versions));
  writeFileSync(join(dir, "404.html"), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${SITE_PATH}/"><title>Neon Goal</title>`);
  writeFileSync(join(dir, ".nojekyll"), "");
  gitIn(dir, "add", "-A");
  gitIn(dir, "commit", "-q", "-m", `Deploy ${folder} ${new Date().toISOString()}`);
  gitIn(dir, "push", "origin", BRANCH);
} finally {
  rmSync(dir, { recursive: true, force: true });
  run("npm", ["run", "build"]);
}
const owner = remote.match(/github\.com[/:]([^/]+)\//)?.[1]?.toLowerCase() ?? "<user>";
console.log(`\nDeployed ${folder}. Live in about a minute at https://${owner}.github.io${SITE_PATH}/`);
