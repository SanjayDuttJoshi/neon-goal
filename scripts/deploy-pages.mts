/**
 * Publishes the game to GitHub Pages (free): checks types and tests, builds
 * for the /neon-goal sub-path, force-pushes the static files to the gh-pages
 * branch, then rebuilds the normal local copy.  Usage: npm run deploy
 *
 * Pushes use the repo's own git identity and credential helper (set once with
 * `git config --local`), so whichever GitHub account is active in `gh` doesn't matter.
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE_PATH = "/neon-goal";
const BRANCH = "gh-pages";

const run = (cmd: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", ...options });
const read = (args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trim();

const remote = read(["remote", "get-url", "origin"]);
const name = read(["config", "user.name"]);
const email = read(["config", "user.email"]);
const helper = read(["config", "--local", "--get-all", "credential.helper"]).split("\n").filter(Boolean).pop() ?? "";

run("npx", ["tsc", "--noEmit"]);
run("npx", ["vitest", "run"]);

const dir = mkdtempSync(join(tmpdir(), "neon-pages-"));
try {
  run("npm", ["run", "build"], { env: { ...process.env, PAGES_BASE_PATH: BASE_PATH } });
  cpSync("out", dir, { recursive: true });
  writeFileSync(join(dir, ".nojekyll"), "");
  const git = (...args: string[]) =>
    run("git", ["-c", `user.name=${name}`, "-c", `user.email=${email}`, "-c", "credential.helper=", "-c", `credential.helper=${helper}`, ...args], { cwd: dir });
  git("init", "-q", "-b", BRANCH);
  git("add", "-A");
  git("commit", "-q", "-m", `Deploy ${new Date().toISOString()}`);
  git("push", "--force", remote, BRANCH);
} finally {
  rmSync(dir, { recursive: true, force: true });
  run("npm", ["run", "build"]);
}
console.log(`\nDeployed. Live in a minute at https://<user>.github.io${BASE_PATH}/`);
